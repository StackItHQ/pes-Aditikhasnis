const express = require("express");

const {google}=require("googleapis");

const app =express();


app.get('/',(req,res)=>{
    const auth=new google.auth.GoogleAuth({
        keyFile:"credentials.json",
        scopes:"https://www.googleapis.com/auth/spreadsheets"

    })
})


const client =await auth.getClient();

const googleSheets=google.sheets({version:"v4",auth: client});


