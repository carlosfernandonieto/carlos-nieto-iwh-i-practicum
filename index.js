require('dotenv').config();
const express = require("express");
const axios = require("axios");
const app = express();
const session = require('express-session');

app.set("view engine", "pug");
app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = 3000;

// Your HubSpot app credentials
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${PORT}/oauth-callback`;
const SCOPES = ['crm.objects.contacts.write','crm.schemas.custom.read', 'crm.objects.custom.read', 'crm.objects.custom.write', 'oauth', 'crm.objects.contacts.read'];

const authUrl =
  'https://app.hubspot.com/oauth/authorize' +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&scope=${encodeURIComponent(SCOPES.join(" "))}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

app.use(
  session({
    secret: Math.random().toString(36).substring(2),
    resave: false,
    saveUninitialized: true,
  })
);

// Root route - Check authentication and redirect if needed
app.get('/', async (req, res) => {
    if (!req.session.access_token) {
        // If no access token, redirect to HubSpot authorization
        return res.redirect(authUrl);
    }

    const contacts = 'https://api.hubspot.com/crm/v3/objects/contacts';
    const headers = {
        Authorization: `Bearer ${req.session.access_token}`,
        'Content-Type': 'application/json'
    }

    try {
        const resp = await axios.get(contacts, { headers });
        const data = resp.data.results;
        res.render('home', { 
            title: 'Home',
            data,
            isAuthorized: true,
            authUrl: authUrl
        });    
    } catch (error) {
        console.error('Error fetching contacts:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            // If token is expired or invalid, clear session and redirect to home
            req.session.destroy();
            return res.redirect('/');
        }
        res.status(500).send('Error fetching contacts');
    }
});

// OAuth callback route
app.get('/oauth-callback', async (req, res) => {
    const code = req.query.code;
    
    if (!code) {
        return res.status(400).send('No authorization code received');
    }

    try {
        // Exchange the authorization code for an access token
        const tokenResponse = await axios.post('https://api.hubapi.com/oauth/v1/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                code: code
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Store the access token in session
        req.session.access_token = tokenResponse.data.access_token;
        
        // Redirect to home page
        res.redirect('/');
    } catch (error) {
        console.error('Error getting access token:', error.response?.data || error.message);
        res.status(500).send('Error getting access token');
    }
});

// Contacts route
// app.get('/contacts', async (req, res) => {
//     if (!req.session.access_token) {
//         return res.redirect('/');
//     }

//     const contacts = 'https://api.hubspot.com/crm/v3/objects/contacts';
//     const headers = {
//         Authorization: `Bearer ${req.session.access_token}`,
//         'Content-Type': 'application/json'
//     }

//     try {
//         const resp = await axios.get(contacts, { headers });
//         const data = resp.data.results;
//         res.render('contacts', { 
//             title: 'Contacts | HubSpot APIs', 
//             data,
//             isAuthorized: true 
//         });    
//     } catch (error) {
//         console.error('Error fetching contacts:', error.response?.data || error.message);
//         if (error.response?.status === 401) {
//             // If token is expired or invalid, clear session and redirect to home
//             req.session.destroy();
//             return res.redirect('/');
//         }
//         res.status(500).send('Error fetching contacts');
//     }
// });

// Update custom object route (as in your original code)
app.get('/update-cobj', async (req, res) => {
    if (!req.session.access_token) {
        return res.redirect('/');
    }
    res.render('update-cobj', { title: 'Update Custom Object' });
});

app.listen(PORT, () => console.log(`=== Starting your app on http://localhost:${PORT} ===`));