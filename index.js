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

    // Updated URL for custom object with ID: locations
    const customObjectEndpoint = 'https://api.hubapi.com/crm/v3/objects/locations?properties=population,country,continent,name';
    const headers = {
        Authorization: `Bearer ${req.session.access_token}`,
        'Content-Type': 'application/json'
    }

    try {
        // You can add query parameters for pagination, properties, etc.
        const resp = await axios.get(customObjectEndpoint, { 
            headers,
        });
        const data = resp.data.results;
        res.render('home', { 
            title: 'Home',
            data,
            isAuthorized: true,
            authUrl: authUrl
        });    
        
    } catch (error) {
        console.error('Error fetching custom object data:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            // If token is expired or invalid, clear session and redirect to home
            req.session.destroy();
            return res.redirect('/');
        }
        res.status(500).send('Error fetching custom object data');
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

// Update custom object route (as in your original code)
app.get('/update-cobj', async (req, res) => {
    if (!req.session.access_token) {
        return res.redirect('/');
    }
    res.render('update-cobj', { title: 'Update Custom Object' });
});

// POST route to handle custom object updates
app.post('/update-cobj', async (req, res) => {
    if (!req.session.access_token) {
        return res.redirect('/');
    }

    const { name, location, population, continent } = req.body;
    
    if (!name || !location || !population || !continent) {
        return res.status(400).send('All fields are required');
    }

    const customObjectEndpoint = 'https://api.hubapi.com/crm/v3/objects/locations';
    const headers = {
        Authorization: `Bearer ${req.session.access_token}`,
        'Content-Type': 'application/json'
    };

    const properties = {
        name: name,
        country: location,
        population: parseInt(population),
        continent: continent
    };

    try {
        const response = await axios.post(customObjectEndpoint, {
            properties: properties
        }, { headers });
        

        // Redirect to home page after successful creation
        res.redirect('/');
    } catch (error) {
        
        if (error.response?.status === 401) {
            // If token is expired or invalid, clear session and redirect to home
            req.session.destroy();
            return res.redirect('/');
        }
        
        // Send more detailed error information to the client
        res.status(500).send(`Error creating custom object: ${JSON.stringify(error.response?.data || error.message)}`);
    }
});

app.listen(PORT, () => console.log(`=== Starting your app on http://localhost:${PORT} ===`));