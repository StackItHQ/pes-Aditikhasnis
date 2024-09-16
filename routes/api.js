const express = require('express');
const router = express.Router();
const { googleSheets, db, SHEET_ID } = require('../config');

// Create (Insert data to MySQL and Google Sheets)
router.post('/create', async (req, res) => {
  const data = req.body;
  try {
    // Insert into MySQL
    db.query('INSERT INTO students SET ?', data, async (err, result) => {
      if (err) {
        console.error('MySQL Insert Error:', err);
        return res.status(500).send(err.message);
      }

      // Append to Google Sheets
      try {
        await googleSheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: 'Sheet1!A3:C',
          valueInputOption: 'RAW',
          resource: {
            values: [Object.values(data)],
          },
        });
        res.send('Data created successfully in both MySQL and Google Sheets');
      } catch (gsError) {
        console.error('Google Sheets Append Error:', gsError);
        res.status(500).send(gsError.message);
      }
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Read (Sync data from Google Sheets to MySQL)
router.get('/read', async (req, res) => {
  try {
    const response = await googleSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A3:C',
    });

    const rows = response.data.values;
    if (rows) {
      rows.forEach(row => {
        db.query(
          'INSERT INTO students (id, name, marks) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=?, marks=?, deleted_at=NULL',
          [row[0], row[1], row[2], row[1], row[2]],
          (err) => {
            if (err) throw err;
          }
        );
      });
    }

    res.send('Data read from Google Sheets and synchronized to MySQL');
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Update (Sync both Google Sheets and MySQL)
router.put('/update/:id', async (req, res) => {
  const id = req.params.id;
  const data = req.body;

  try {
    // Update MySQL
    db.query('UPDATE students SET ? WHERE id = ?', [data, id], async (err, result) => {
      if (err) {
        console.error('MySQL Update Error:', err);
        return res.status(500).send(err.message);
      }

      // Update Google Sheets
      try {
        await googleSheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `Sheet1!A${parseInt(id, 10) + 2}:C`, // Adjust range based on row ID
          valueInputOption: 'RAW',
          resource: {
            values: [Object.values(data)],
          },
        });

        res.send('Data updated successfully in both MySQL and Google Sheets');
      } catch (gsError) {
        console.error('Google Sheets Update Error:', gsError);
        res.status(500).send(gsError.message);
      }
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Delete (Remove data from MySQL and Google Sheets)
router.delete('/delete/:id', async (req, res) => {
  const id = req.params.id;

  try {
    // Soft delete in MySQL (set deleted_at to current timestamp)
    db.query('UPDATE students SET deleted_at = NOW() WHERE id = ?', [id], async (err, result) => {
      if (err) {
        console.error('MySQL Delete Error:', err);
        return res.status(500).send(err.message);
      }

      // Delete from Google Sheets
      try {
        await googleSheets.spreadsheets.values.clear({
          spreadsheetId: SHEET_ID,
          range: `Sheet1!A${parseInt(id, 10) + 2}:C`, // Adjust range based on row ID
        });

        res.send('Data deleted successfully from both MySQL and Google Sheets');
      } catch (gsError) {
        console.error('Google Sheets Delete Error:', gsError);
        res.status(500).send(gsError.message);
      }
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;
