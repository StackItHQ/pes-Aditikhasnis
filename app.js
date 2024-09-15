const express = require('express');
const bodyParser = require('body-parser');
const schedule = require('node-schedule');
const { googleSheets, db, SHEET_ID } = require('./config');
const apiRoutes = require('./routes/api');  // Import API routes

let lastCheckTime = new Date();

const app = express();
app.use(bodyParser.json());
app.use('/api', apiRoutes);  // Use the API routes

// Schedule: Poll Google Sheets every minute
schedule.scheduleJob('*/1 * * * *', async function () {
  try {
    const response = await googleSheets.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A3:C',
    });

    const rows = response.data.values;
    if (rows && rows.length) {
      rows.forEach(row => {
        db.query(
          'INSERT INTO students (id, name, marks) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=?, marks=?',
          [row[0], row[1], row[2], row[1], row[2]],
          (err) => {
            if (err) throw err;
            console.log(`Synchronized student: ${row[1]} (${row[0]})`);
          }
        );
      });
    }
    console.log('Google Sheets synchronized to MySQL');
    lastCheckTime = new Date();
  } catch (error) {
    console.error('Error synchronizing Google Sheets:', error);
  }
});

// Schedule: Poll MySQL for changes every minute
schedule.scheduleJob('*/1 * * * *', async function () {
  try {
    db.query('SELECT * FROM students WHERE modified_at > ?', [lastCheckTime], async (err, rows) => {
      if (err) throw err;

      for (const row of rows) {
        await googleSheets.update({
          spreadsheetId: SHEET_ID,
          range: `Sheet1!A${row.id}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[row.id, row.name, row.marks]],
          },
        });
        console.log(`Synchronized student to Google Sheets: ${row.name} (ID: ${row.id})`);
      }

      lastCheckTime = new Date();
    });
  } catch (error) {
    console.error('Error synchronizing MySQL to Google Sheets:', error);
  }
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
