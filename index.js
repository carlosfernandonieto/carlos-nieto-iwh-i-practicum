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
const PRIVATE_APP_ACCESS = process.env.PRIVATE_APP_ACCESS;

app.use(
  session({
    secret: Math.random().toString(36).substring(2),
    resave: false,
    saveUninitialized: true,
  })
);

// Root route - Check authentication and redirect if needed
app.get('/', async (req, res) => {
    // Updated URL for custom object with ID: locations
    const customObjectEndpoint = 'https://api.hubapi.com/crm/v3/objects/locations?properties=population,country,continent,name';
    const headers = {
        Authorization: `Bearer ${PRIVATE_APP_ACCESS}`,
        'Content-Type': 'application/json'
    }

    try {
        // You can add query parameters for pagination, properties, etc.
        const resp = await axios.get(customObjectEndpoint, { 
            headers,
        });
        const data = resp.data.results;
        res.render('home', { 
            title: 'Custom Object Data |  Integrating With HubSpot I Practicum',
            data,
            isAuthorized: true,
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

// Update custom object route (as in your original code)
app.get('/update-cobj', async (req, res) => {
    res.render('update-cobj', { title: 'Update Custom Object Form | Integrating With HubSpot I Practicum' });
});

// POST route to handle custom object updates
app.post('/update-cobj', async (req, res) => {
    if (!PRIVATE_APP_ACCESS) {
        return res.redirect('/');
    }

    const { name, location, population, continent } = req.body;
    
    if (!name || !location || !population || !continent) {
        return res.status(400).send('All fields are required');
    }

    const customObjectEndpoint = 'https://api.hubapi.com/crm/v3/objects/locations';
    const headers = {
        Authorization: `Bearer ${PRIVATE_APP_ACCESS}`,
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