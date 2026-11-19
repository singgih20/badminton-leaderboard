// Google Apps Script: set Script Properties APP_SECRET and SPREADSHEET_ID.
// Deploy as Web App: Execute as Me, access Anyone. Requests are authenticated by secret.
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const props = PropertiesService.getScriptProperties();
    if (!req.secret || req.secret !== props.getProperty('APP_SECRET')) throw Error('Unauthorized');
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    let sheet = ss.getSheetByName('State');
    if (!sheet) sheet = ss.insertSheet('State');
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw Error('Server sibuk, coba lagi');
    try {
      const count = Number(sheet.getRange('B1').getValue()) || 0;
      const revision = String(sheet.getRange('C1').getValue() || '0');
      let data = {projects:[],activeProjectId:''};
      if (count > 0) {
        const parts = sheet.getRange(2,1,count,1).getValues().map(row=>String(row[0]||''));
        data = JSON.parse(parts.join(''));
      }
      if (req.action === 'read') return respond({ok:true,data:data,revision:revision});
      if (req.action !== 'write') throw Error('Action tidak dikenal');
      if (String(req.expectedRevision) !== revision) throw Error('CONFLICT: data telah berubah; refresh sebelum menyimpan');
      if (!req.data || !Array.isArray(req.data.projects)) throw Error('Data tidak valid');
      const serialized = JSON.stringify(req.data);
      if (serialized.length > 3500000) throw Error('Data terlalu besar');
      const chunks = serialized.match(/[\s\S]{1,30000}/g) || [''];
      const nextRevision = Utilities.getUuid();
      // write payload first, metadata last
      sheet.getRange(2,1,chunks.length,1).setValues(chunks.map(x=>[x]));
      sheet.getRange('A1:C1').setValues([['BADMIN_STATE',chunks.length,nextRevision]]);
      SpreadsheetApp.flush();
      return respond({ok:true,revision:nextRevision});
    } finally {lock.releaseLock()}
  } catch(err) {return respond({ok:false,error:String(err.message||err)})}
}
function respond(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
