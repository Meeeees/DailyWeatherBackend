const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const cors = require('cors');
const User = require('./database/database.js');
const jwt = require('jsonwebtoken');
const NodeMailer = require('nodemailer');
const dotenv = require('dotenv');
const Schedule = require('node-schedule');
dotenv.config();
const axios = require('axios');
const mongoose = require('mongoose');
let MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
app.use(cors());

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let transporter = NodeMailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});

app.get('/', (req, res) => res.render('index'));

app.post('/signup', (req, res) => {
    try {
        setTimeout(() => {
            const user = new User({
                name: req.body.name,
                email: req.body.email,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
            });

            user.save()
                .then((result) => {
                    console.log(result);
                    res.json({ message: 'User created!' });
                    let token = jwt.sign({ email: req.body.email }, process.env.SECRET_KEY, { expiresIn: '1h' }); //
                    let html = `Thank you for signing up, ${req.body.name}! <br> You have successfully signed up for the daily wheater email. <br> Please verify your email by clicking on the link: <a href="http://localhost:3000/verify/${token}">Verify email</a>`
                    let mailOptions = {
                        from: process.env.EMAIL,
                        to: req.body.email,
                        subject: 'Welcome to the club!',
                        html: html


                    };
                    transporter.sendMail(mailOptions, (err, data) => {
                        if (err) {
                            console.log('Error occurs', err);
                        } else {
                            console.log('Email sent!');
                        }
                    });


                })
                .catch((err) => {
                    console.log(err);
                    if (err.code === 11000) {
                        res.status(409).json({ message: 'User already exists!' });

                    } else {
                        res.json({ message: 'User not created!' });

                    }
                });

        }, 2000);
    } catch (error) {
        console.log(error);
        res.json({ message: 'User not created!' });
    }

});

app.get('/verify/:token', async (req, res) => {
    try {
        let token = req.params.token;
        let decoded = jwt.verify(token, process.env.SECRET_KEY);
        console.log(decoded, decoded.email);

        let result = await User.findOneAndUpdate(
            { email: decoded.email },
            { EmailVerified: true },
            { new: true },
        );



        if (result) {
            res.json(result);
        } else {
            res.json({ message: 'User not found or not verified!' });
        }
    } catch (error) {
        console.log(error);
        res.json({ message: 'User not verified!' });
    }

});


Schedule.scheduleJob({ hour: 7 }, async () => {
    const users = await User.find({ EmailVerified: true })
    users.forEach(async (user) => {
        let lat = user.latitude;
        let lon = user.longitude;
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.WEATHER_API_KEY}`);
        console.log(response.data);
        let template = `
        Hello, ${user.name}! <br>

        Currently the weather in ${response.data.name} is ${response.data.weather[0].description} with a temperature of ${Math.round((response.data.main.temp - 272.15) * 100) / 100} degrees Celsius. <br>  
        The minimum temperature is ${Math.round((response.data.main.temp_min - 272.15) * 100) / 100} degrees Celsius and the maximum temperature is ${Math.round((response.data.main.temp_max - 272.15) * 100) / 100} degrees Celsius. <br>
        
        The sun has risen at ${new Date(response.data.sys.sunrise * 1000).toLocaleTimeString()} and will set at ${new Date(response.data.sys.sunset * 1000).toLocaleTimeString()}. <br>

        Have a nice day! <br>
            `;
        let mailOptions = {
            from: process.env.EMAIL,
            to: user.email,
            subject: 'Weather update',
            html: template
        };


        transporter.sendMail(mailOptions, (err, data) => {
            if (err) {
                console.log('Error occurs', err);
            } else {
                console.log(data)
                console.log('Email sent!');
            }
        });
    })
})




app.listen(port, () => console.log(`Example app listening on port ${port} !`));
