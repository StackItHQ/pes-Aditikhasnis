const express = require('express');
const bodyParser = require('body-parser');
const schedule = require('node-schedule');
const { googleSheets, db, SHEET_ID } = require('./config');
const apiRoutes = require('./routes/api');

const app = express();
app.use(bodyParser.json());
app.use('/api', apiRoutes);

// Variable to track the last synchronization time
let lastSyncTime = new Date();

// Schedule: Poll Google Sheets for changes every minute
schedule.scheduleJob('*/1 * * * *', async function () {
  console.log('Checking Google Sheets for changes...');
  try {
    const response = await googleSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A3:C',
    });

    const rows = response.data.values;
    if (rows && rows.length) {
      rows.forEach(row => {
        db.query(
          'INSERT INTO students (id, name, marks) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=?, marks=?, deleted_at=NULL',
          [row[0], row[1], row[2], row[1], row[2]],
          (err) => {
            if (err) throw err;
            console.log(`Synchronized student from Google Sheets: ${row[1]} (ID: ${row[0]})`);
          }
        );
      });
    }
    console.log('Google Sheets synchronized to MySQL');
    lastSyncTime = new Date();
  } catch (error) {
    console.error('Error synchronizing Google Sheets to MySQL:', error.message);
  }
});

// Schedule: Poll MySQL for changes every minute
schedule.scheduleJob('*/1 * * * *', function () {
  console.log('Checking MySQL for changes...');
  db.query('SELECT * FROM students WHERE modified_at > ? OR deleted_at > ?', [lastSyncTime, lastSyncTime], async (err, rows) => {
    if (err) {
      console.error('Error querying MySQL for changes:', err.message);
      return;
    }

    for (const row of rows) {
      try {
        if (row.deleted_at) {
          // If the row is marked as deleted in MySQL, delete it in Google Sheets
          await googleSheets.spreadsheets.values.clear({
            spreadsheetId: SHEET_ID,
            range: `Sheet1!A${parseInt(row.id, 10) + 2}:C`, // Adjust range based on row ID
          });
          console.log(`Deleted student from Google Sheets: ${row.name} (ID: ${row.id})`);
        } else {
          // Otherwise, update the existing row in Google Sheets
          await googleSheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `Sheet1!A${parseInt(row.id, 10) + 2}:C`, // Adjust range based on row ID
            valueInputOption: 'RAW',
            resource: {
              values: [[row.id, row.name, row.marks]],
            },
          });
          console.log(`Updated student in Google Sheets: ${row.name} (ID: ${row.id})`);
        }
      } catch (gsError) {
        console.error('Error synchronizing MySQL to Google Sheets:', gsError.message);
      }
    }

    lastSyncTime = new Date();
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
