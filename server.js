import express from 'express';
import path from 'path';
import fs from 'fs';
import { getFrenchFormattedDate, fetchTemplate, generateReport, ensureDirectoryExists, getAirtableSchema, processFieldsForDocx, getAirtableRecords, getAirtableRecord, ymd } from './utils.js';

import { Stream } from 'stream';
import archiver from 'archiver';
const app = express();
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded


app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

app.get('/schemas', async (req, res) => {
  try {
    const schema = await getAirtableSchema();
    if (!schema) {
      console.log('Failed to retrieve schema.');
      return res.status(500).json({ success: false, error: 'Failed to retrieve schema.' });
    }
    // Extract only the names of the fields
    let mdFieldsSession = schema.find(table => table.name === 'Sessions').fields
    // let mdFieldsSession = schema.find(table => table.name === 'Sessions').fields
    .filter(field => {
      if (field.type === 'richText') {
        return field.name;
      } else if (field.type === 'multipleLookupValues') {
        if (field.options.result.type === 'richText') return field.name;
      } else {
        return null;
      }
    })
    .map(field => field.name); // Map to only field names
    
    res.json({champsMarkdown: mdFieldsSession});
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



app.get('/catalogue', async (req, res) => {
  // res.sendFile(path.join(process.cwd(), 'index.html'));
  const table = "Sessions";
  const view = "Grid view";
  // const view = "Catalogue";
  var { annee } = req.query;

  if(!annee) { annee = new Date().getFullYear() + 1; }

  // const formula = `AND(OR({année}=${annee},{année}=""), OR(FIND(lieuxdemij_cumul,"iège"),FIND(lieuxdemij_cumul,"visio")))`; 
  const formula = `
  OR(
    AND(
        {année}="", 
        FIND(lieuxdemij_cumul,"intra")
    ),
    AND(
        {année}=2025, 
        FIND(lieuxdemij_cumul,"intra")=0
    )
  )`

  try {
    const data = await getAirtableRecords(table, view, formula, "du", "asc");
    if (data) {
      console.log('Data successfully retrieved:', data.records.length, "records");
      // broadcastLog(`Data successfully retrieved: ${data.records.length} records`);
    } else {
      console.log('Failed to retrieve data.');
      // broadcastLog('Failed to retrieve data.');
    }
    
    // Generate and send the report
    await generateAndSendReport(
      'https://github.com/isadoravv/templater/raw/refs/heads/main/templates/catalogue.docx', 
      data, 
      res,
      'Catalogue des formations FSH ' + annee
    );
    // res.render('index', { title: 'Catalogue', heading: `Catalogue : à partir de ${table}/${view}` });
  } catch (error) {
    console.error('Error:', error);
    // broadcastLog(`Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
  
});

app.get('/programme', async (req, res) => {
  // res.sendFile(path.join(process.cwd(), 'index.html'));
  const table="Sessions";
  // const recordId="recAzC50Q7sCNzkcf";
  const { recordId } = req.query;
  
  if (!recordId) {
    return res.status(400).json({ success: false, error: 'Paramètre recordId manquant.' });
  }
  try {
    const data = await getAirtableRecord(table, recordId);
    if (data) {
      console.log('Data successfully retrieved:', data.length);
      // broadcastLog(`Data successfully retrieved: ${data.length} records`);
    } else {
      console.log('Failed to retrieve data.');
      // broadcastLog('Failed to retrieve data.');
    }

    let newTitle = data["titre_fromprog"]
    if(data["du"] && data["au"]) { newTitle+= `${ymd(data["du"])}-${data["au"] && ymd(data["au"])}`}
    
    // Generate and send the report
    await generateAndSendReport(
      'https://github.com/isadoravv/templater/raw/refs/heads/main/templates/programme.docx', 
      data, 
      res,
      newTitle || "err titre prog"
    );
    // res.render('index', { title: `Générer un Programme pour ${recordId}`, heading: 'Programme' });
  } catch (error) {
    console.error('Error:', error);
    // broadcastLog(`Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
  
});  


app.get('/devis', async (req, res) => {
  // res.sendFile(path.join(process.cwd(), 'index.html'));
  const table="Devis";
  // const recordId="recAzC50Q7sCNzkcf";
  const { recordId } = req.query;
  
  if (!recordId) {
    return res.status(400).json({ success: false, error: 'Paramètre recordId manquant.' });
  }
  try {
    const data = await getAirtableRecord(table, recordId);
    if (data) {
      console.log('Data successfully retrieved:', data.length);
      // broadcastLog(`Data successfully retrieved: ${data.length} records`);
    } else {
      console.log('Failed to retrieve data.');
      // broadcastLog('Failed to retrieve data.');
    }

    let newTitle = `DEVIS FSH ${data["id"]} `
    // if(data["du"] && data["au"]) { newTitle+= `${ymd(data["du"])}-${data["au"] && ymd(data["au"])}`}
    
    // Generate and send the report
    await generateAndSendReport(
      'https://github.com/isadoravv/templater/raw/refs/heads/main/templates/devis.docx', 
      data, 
      res,
      newTitle
    );
    // res.render('index', { title: `Générer un Programme pour ${recordId}`, heading: 'Programme' });
  } catch (error) {
    console.error('Error:', error);
    // broadcastLog(`Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
  
});  


app.get('/facture', async (req, res) => {
  // res.sendFile(path.join(process.cwd(), 'index.html'));
  const table="Inscriptions";
  // const recordId="recAzC50Q7sCNzkcf";
  const { recordId } = req.query;
  
  if (!recordId) {
    return res.status(400).json({ success: false, error: 'Paramètre recordId manquant.' });
  }
  try {
    const data = await getAirtableRecord(table, recordId);
    if (data) {
      console.log('Data successfully retrieved:', data.length);
      // broadcastLog(`Data successfully retrieved: ${data.length} records`);
    } else {
      console.log('Failed to retrieve data.');
      // broadcastLog('Failed to retrieve data.');
    }
    
    // Generate and send the report
    await generateAndSendReport(
      'https://github.com/isadoravv/templater/raw/refs/heads/main/templates/programme.docx', 
      data, 
      res,
      `${data["id"]} ${data["nom"]} ${data["prenom"]}`
    );
    // res.render('index', { title: `Générer un Programme pour ${recordId}`, heading: 'Programme' });
  } catch (error) {
    console.error('Error:', error);
    // broadcastLog(`Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
  
});  


app.get('/factures', async (req, res) => {
  const table = "Inscriptions";
  const { sessionId } = req.query
  // const { recordIds } = req.query; // Assuming recordIds is an array of Airtable IDs


  console.log(sessionId)
  const session = await getAirtableRecord("Sessions", sessionId)
  // console.log(session)

  // if (!recordIds || !Array.isArray(recordIds)) {
  //   return res.status(400).json({ success: false, error: 'Paramètre recordIds manquant ou invalide.' });
  // }

  // try {
  //   // Create a zip archive in memory
  //   const zip = archiver('zip', { zlib: { level: 9 } });
  //   const zipStream = new Stream.PassThrough();
    
  //   res.attachment('factures.zip');
  //   zip.pipe(zipStream);
  //   zipStream.pipe(res);

  //   // Loop through recordIds and generate documents
  //   for (const recordId of recordIds) {
  //     const data = await getAirtableRecord(table, recordId);
  //     if (data) {
  //       const templateUrl = 'https://github.com/isadoravv/templater/raw/refs/heads/main/templates/programme.docx';
  //       const buffer = await generateReport(await fetchTemplate(templateUrl), data);
        
  //       const fileName = `${getFrenchFormattedDate(false)} ${data["id"]} ${data["nom"]} ${data["prenom"]}.docx`;
        
  //       // Add the generated document to the ZIP archive
  //       zip.append(buffer, { name: fileName });
  //     }
  //   }

  //   // Finalize the zip file
  //   await zip.finalize();

  // } catch (error) {
  //   console.error('Error generating factures:', error);
  //   res.status(500).json({ success: false, error: error.message });
  // }
});



// Reusable function to generate and send report
async function generateAndSendReport(url, data, res, fileName = "") {
  try {
    console.log('Generating report...');
    
    // Fetch the template and generate the report buffer
    const template = await fetchTemplate(url);
    const buffer = await generateReport(template, data); // This should return the correct binary buffer

    // Determine the file name
    const originalFileName = path.basename(url);
    const fileNameWithoutExt = originalFileName.replace(path.extname(originalFileName), '');
    let newTitle = fileName || fileNameWithoutExt;

    const newFileName = `${getFrenchFormattedDate(false)} ${newTitle}.docx`;

    // Set the correct headers for file download and content type for .docx
    res.setHeader('Content-Disposition', `attachment; filename="${newFileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Length', buffer.length); // Ensure the buffer length is correctly sent

    // Send the buffer as a binary response
    res.end(buffer, 'binary');
    
    console.log('Report generated and sent as a download.');

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Fetches the template from the provided URL and generates a report buffer using the given data.
 * 
 * @async
 * @function generateReportBuffer
 * 
 * @param {string} url - The URL from which to fetch the document template (e.g., a .docx template).
 * @param {object} data - The data used to fill the template (e.g., dynamic content that will be inserted into the template).
 * 
 * @returns {Promise<Buffer>} - Returns a Promise that resolves to a Buffer containing the generated report.
 * 
 * @throws {Error} - Throws an error if fetching the template or generating the report fails.
 * 
 * @example
 * const buffer = await generateReportBuffer('https://example.com/template.docx', { title: 'Report 1' });
 */
async function generateReportBuffer(url, data) {
  try {
    const template = await fetchTemplate(url);
    const buffer = await generateReport(template, data);
    return buffer;
  } catch (error) {
    throw new Error(`Error generating report buffer: ${error.message}`);
  }
}
/**
 * Creates a zip archive from multiple file buffers and sends the zip to the client for download.
 * 
 * @async
 * @function createZipArchive
 * 
 * @param {Array<{ fileName: string, buffer: Buffer }>} files - An array of objects representing the files to be added to the zip archive. Each object should have a `fileName` (string) and a `buffer` (Buffer).
 * @param {object} res - The Express.js response object used to stream the zip file as a download to the client.
 * @param {string} [zipFileName="reports.zip"] - The name of the zip file to be sent for download (default: "reports.zip").
 * 
 * @returns {Promise<void>} - Returns a Promise that resolves when the zip archive is successfully created and sent.
 * 
 * @throws {Error} - Throws an error if creating the zip archive or streaming it to the response fails.
 * 
 * @example
 * const files = [
 *   { fileName: 'report1.docx', buffer: buffer1 },
 *   { fileName: 'report2.docx', buffer: buffer2 }
 * ];
 * await createZipArchive(files, res, 'all_reports.zip');
 */
async function createZipArchive(files, res, zipFileName = "reports.zip") {
  try {
    // Create a zip archive in memory
    const archive = archiver('zip', { zlib: { level: 9 } }); // Maximum compression

    // Prepare the response headers for sending the zip
    res.setHeader('Content-Disposition', `attachment; filename=${zipFileName}`);
    res.setHeader('Content-Type', 'application/zip');

    // Pipe the archive's output to the response
    archive.pipe(res);

    // Add each file buffer to the archive
    for (const { fileName, buffer } of files) {
      archive.append(buffer, { name: fileName });
    }

    // Finalize the archive
    await archive.finalize();

    console.log('Zip archive created and sent.');
  } catch (error) {
    throw new Error(`Error creating zip archive: ${error.message}`);
  }
}





// Start the server
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port http://localhost:${process.env.PORT || 3000}/`);
});

