/** Script Properties: SPREADSHEET_ID, APP_SECRET.
 * Deploy as Web App: Execute as Me, access Anyone.
 */
const ADMIN_PASSWORD = 'Admin123!';

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('APP_SECRET');
    if (!secret || !req.secret || req.secret !== secret) throw Error('Unauthorized');
    const action = String(req.action || '');
    if (action === 'login') {
      return respond({ok:true, authenticated:typeof req.password==='string' && req.password.length>0 && req.password===ADMIN_PASSWORD});
    }
    if (action !== 'read' && action !== 'write') throw Error('Action tidak dikenal');
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
      if (action === 'read') return respond({ok:true,data,revision});
      if (String(req.expectedRevision) !== revision) throw Error('CONFLICT: data telah berubah; refresh sebelum menyimpan');
      if (!req.data || !Array.isArray(req.data.projects)) throw Error('Data tidak valid');
      const serialized = JSON.stringify(req.data);
      if (serialized.length > 3500000) throw Error('Data terlalu besar');
      const chunks = serialized.match(/[\s\S]{1,30000}/g) || [''];
      const nextRevision = Utilities.getUuid();
      sheet.getRange(2,1,chunks.length,1).setValues(chunks.map(x=>[x]));
      sheet.getRange('A1:C1').setValues([['BADMIN_STATE',chunks.length,nextRevision]]);
      SpreadsheetApp.flush();
      return respond({ok:true,revision:nextRevision});
    } finally {lock.releaseLock()}
  } catch(err) {return respond({ok:false,error:String(err.message||err)})}
}
function respond(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
