//DEPENDENCIES
const dotenv = require('dotenv');
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors')
const app = express();
const fs = require('fs');
const moment = require('moment');
const dirTree = require("directory-tree");
const axios = require("axios");

dotenv.config();

//GLOBALS
const PORT = process.env.PORT || 8080;
const { SERVER_TOKEN, CURRENCY_API_KEY } = process.env;

//FUNCTIONS
const writeJSONFile = (file, path) => {
    fs.writeFileSync(path, JSON.stringify(file, null, 2), (err) => {
        if(err){console.error(err);}
    });
}
const readJSONFile = (path) => {
    if(!fs.existsSync(path)){return null}
    const file = fs.readFileSync(path, (err)=>{
        if(err){console.error(err)}
    });
    return JSON.parse(file);
}

if(!fs.existsSync('./jdatabase')){
    fs.mkdirSync('./jdatabase');
}

app.use(cors());
app.use(express.json());

app.get('/test', (req, res) => {
    res.status(200).send('API is online.');
});

const range = 2.5 * 60 * 60 * 1000;
const conversionRateUrl = './jdatabase/conversion-rate.json';
const loadConversionRates = () => {
    const conversionRates = readJSONFile(conversionRateUrl) || {};
    if(!conversionRates.date || Date.now() - conversionRates.date > range){
        console.log('Updating conversion rates...');
        const params = {
            apikey: CURRENCY_API_KEY,
            base_currency: 'EUR'
        };
        axios.get('https://api.currencyapi.com/v3/latest', {params})
        .then(res => {
            writeJSONFile({date: Date.now(), data: res.data.data}, conversionRateUrl);
            setTimeout(loadConversionRates, 1000);
            console.log('Conversion rates successfully updated.');
        })
        .catch(err => {
            console.log('Error while updating conversion rates.');
            console.error(err);
            setTimeout(loadConversionRates, 1000);
        });
    }else{
        setTimeout(loadConversionRates, 1000);
    }
}
loadConversionRates();
app.get('/convert', async (req, res) => {
    let {token, amount, from, to} = req.query;
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token is missing or not valid.');
    }else if(!amount || !from || !to){
        res.status(401).send('Bad request: amount, from or to missing.');
    }else if(isNaN(amount)){
        res.status(401).send('Amount has to be a number.');
    }else if(amount <= 0){
        res.status(401).send('Amount has to be greater than zero.');
    }else if(from === to){
        res.status(401).send('You cannot convert from a currency to the same one.');
    }else{
        amount = Number(amount);
        from = from.toUpperCase();
        to = to.toUpperCase();
        const conversionRates = readJSONFile(conversionRateUrl).data || {};
        if(!conversionRates[from]){
            res.status(401).send(`"${from}" is not a currency code or it's not available.`);
        }else if(!conversionRates[to]){
            res.status(401).send(`"${to}" is not a currency code or it's not available.`);
        }else{
            const amountToEur = from === 'EUR'? amount : amount / conversionRates[from].value;
            const convertedAmount = to === 'EUR'? amountToEur : amountToEur * conversionRates[to].value;
            res.status(200).send({value: convertedAmount, currency: to});
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}.`);
});
