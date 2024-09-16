const { google } = require('googleapis');
const mysql = require('mysql2');
const path = require('path');

// Initialize Google Sheets API with authentication
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'credentials.json'), // Path to your credentials file
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const googleSheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = '1RYNKyq_8lji_LQG2pvSIRXfx8u-wOQZjjs9Jt5kiun8'; // Replace with your Sheet ID

// Initialize MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'guddi@12345', // Replace with your MySQL password
  database: 'student',
  port: 3306,
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});

module.exports = { googleSheets, db, SHEET_ID };
