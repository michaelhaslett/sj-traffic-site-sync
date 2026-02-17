/**
 * Google Apps Script v2 — Web App endpoint for the SJ Traffic Site Checklist.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet (this will be your checklist log)
 * 2. Open Extensions > Apps Script
 * 3. Paste this entire file into Code.gs
 * 4. Click Deploy > New deployment
 * 5. Set Type = "Web app"
 * 6. Set "Execute as" = "Me"
 * 7. Set "Who has access" = "Anyone" (so the PWA can POST without auth)
 * 8. Click Deploy and copy the URL
 * 9. Paste the URL into the PWA Settings screen
 *
 * Handles: checklists, incidents, equipment loss reports.
 * Auto-creates sheets and sends email notifications.
 */

// Replace with your actual Sheet ID if needed, or leave blank to auto-use bound sheet
const SHEET_ID = '';

// Email addresses (can also be configured via the PWA settings page)
const HSEQ_EMAIL = '';           // e.g. hseq@sjtraffic.com.au
const LOST_EQUIPMENT_EMAIL = ''; // e.g. ops@sjtraffic.com.au

function getSpreadsheet() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = getSpreadsheet();
    const syncType = data.syncType || 'checklist';

    switch (syncType) {
      case 'checklist':
        return handleChecklist(ss, data);
      case 'incident':
        return handleIncident(ss, data);
      case 'equipment_loss':
        return handleEquipmentLoss(ss, data);
      default:
        // Fallback to v1 checklist handling
        return handleChecklist(ss, data);
    }

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Checklist / Full Job Handler ────────────────────────

function handleChecklist(ss, data) {
  // Summary sheet
  let summary = ss.getSheetByName('Checklist Summary');
  if (!summary) {
    summary = ss.insertSheet('Checklist Summary');
    summary.appendRow([
      'Timestamp', 'Job ID', 'Client', 'Project', 'Location', 'Job Date',
      'Characteristics', 'Total Items', 'Checked Items',
      'Weather Visibility', 'Weather Conditions', 'HSEQ Notes',
      'Signed Off By', 'Sign-Off Time', 'GPS Lat', 'GPS Lng',
      'Final Sign-Off By', 'Final Sign-Off Time',
      'Equipment Returned', 'Missing Items',
      'Incident Count', 'Photo Count',
      'Started At', 'Completed At', 'App Version'
    ]);
    summary.getRange(1, 1, 1, summary.getLastColumn()).setFontWeight('bold');
    summary.setFrozenRows(1);
  }

  const checklistGps = data.checklistSignOff?.gps || data.signOff?.gps || {};
  const weather = data.weather || {};
  const shutdown = data.shutdown || {};
  const missingCount = shutdown.missing ? Object.keys(shutdown.missing).length : 0;

  summary.appendRow([
    new Date(),
    data.jobId || '',
    data.client || '',
    data.project || '',
    data.location || '',
    data.date || '',
    (data.characteristics || []).join(', '),
    data.totalItems || 0,
    data.checkedItems || 0,
    weather.visibility || '',
    weather.weather || '',
    data.hseqNotes || '',
    data.checklistSignOff?.name || data.signOff?.name || '',
    data.checklistSignOff?.timestamp || data.signOff?.timestamp || '',
    checklistGps.lat || '',
    checklistGps.lng || '',
    data.finalSignOff?.name || '',
    data.finalSignOff?.timestamp || '',
    shutdown.skipped ? 'Skipped' : 'Yes',
    missingCount > 0 ? missingCount + ' items' : 'None',
    data.incidentCount || 0,
    data.photos ? data.photos.length : 0,
    data.startedAt || '',
    data.completedAt || '',
    data.appVersion || ''
  ]);

  // Detail sheet
  let detail = ss.getSheetByName('Checklist Detail');
  if (!detail) {
    detail = ss.insertSheet('Checklist Detail');
    detail.appendRow([
      'Timestamp', 'Job ID', 'Item ID', 'Category', 'Label',
      'Checked', 'Note', 'Checked At'
    ]);
    detail.getRange(1, 1, 1, detail.getLastColumn()).setFontWeight('bold');
    detail.setFrozenRows(1);
  }

  const now = new Date();
  const items = data.items || [];
  for (const item of items) {
    detail.appendRow([
      now,
      data.jobId || '',
      item.id || '',
      item.category || '',
      item.label || '',
      item.checked ? 'Yes' : 'No',
      item.note || '',
      item.timestamp || ''
    ]);
  }

  // Equipment sheet
  if (data.equipment) {
    let equipSheet = ss.getSheetByName('Equipment Checks');
    if (!equipSheet) {
      equipSheet = ss.insertSheet('Equipment Checks');
      equipSheet.appendRow([
        'Timestamp', 'Job ID', 'Client', 'Project',
        'Item ID', 'Quantity Taken', 'Started At', 'Completed At'
      ]);
      equipSheet.getRange(1, 1, 1, equipSheet.getLastColumn()).setFontWeight('bold');
      equipSheet.setFrozenRows(1);
    }

    const quantities = data.equipment.quantities || {};
    for (const [itemId, qty] of Object.entries(quantities)) {
      if (qty > 0) {
        equipSheet.appendRow([
          now,
          data.jobId || '',
          data.client || '',
          data.project || '',
          itemId,
          qty,
          data.equipment.startedAt || '',
          data.equipment.completedAt || ''
        ]);
      }
    }
  }

  return ContentService.createTextOutput(
    JSON.stringify({ success: true, type: 'checklist', rowsWritten: items.length + 1 })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ── Incident Handler ────────────────────────────────────

function handleIncident(ss, data) {
  let sheet = ss.getSheetByName('Incidents');
  if (!sheet) {
    sheet = ss.insertSheet('Incidents');
    sheet.appendRow([
      'Timestamp', 'Job ID', 'Category', 'Description',
      'Reported By', 'GPS Lat', 'GPS Lng', 'Has Photo',
      'Incident Time'
    ]);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const gps = data.gps || {};
  const reporter = data.reportedBy || {};
  sheet.appendRow([
    new Date(),
    data.jobId || '',
    data.category || '',
    data.description || '',
    reporter.name || reporter || '',
    gps.lat || '',
    gps.lng || '',
    data.photo ? 'Yes' : 'No',
    data.timestamp || ''
  ]);

  // Send email notification
  const emailTo = HSEQ_EMAIL;
  if (emailTo) {
    try {
      const categoryLabel = {
        'incident': 'INCIDENT',
        'near_miss': 'NEAR MISS',
        'hazard': 'HAZARD'
      }[data.category] || data.category || 'INCIDENT';

      MailApp.sendEmail({
        to: emailTo,
        subject: '[SJ Traffic] ' + categoryLabel + ' Report - Job ' + (data.jobId || 'Unknown'),
        htmlBody: buildIncidentEmail(data, categoryLabel)
      });
    } catch (emailErr) {
      // Log but don't fail the sync
      console.error('Email send failed:', emailErr);
    }
  }

  return ContentService.createTextOutput(
    JSON.stringify({ success: true, type: 'incident' })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ── Equipment Loss Handler ──────────────────────────────

function handleEquipmentLoss(ss, data) {
  let sheet = ss.getSheetByName('Equipment Loss');
  if (!sheet) {
    sheet = ss.insertSheet('Equipment Loss');
    sheet.appendRow([
      'Timestamp', 'Job ID', 'Client', 'Project',
      'Item ID', 'Item Label', 'Taken', 'Returned', 'Lost',
      'Reported By'
    ]);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const missing = data.missing || {};
  const now = new Date();
  for (const [itemId, info] of Object.entries(missing)) {
    sheet.appendRow([
      now,
      data.jobId || '',
      data.client || '',
      data.project || '',
      itemId,
      info.label || '',
      info.taken || 0,
      info.returned || 0,
      info.lost || 0,
      data.reportedBy || ''
    ]);
  }

  // Send email notification
  const emailTo = LOST_EQUIPMENT_EMAIL || HSEQ_EMAIL;
  if (emailTo && Object.keys(missing).length > 0) {
    try {
      MailApp.sendEmail({
        to: emailTo,
        subject: '[SJ Traffic] Lost Equipment - Job ' + (data.jobId || 'Unknown') + ' - ' + (data.client || ''),
        htmlBody: buildEquipmentLossEmail(data, missing)
      });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }
  }

  return ContentService.createTextOutput(
    JSON.stringify({ success: true, type: 'equipment_loss' })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ── Email Templates ─────────────────────────────────────

function buildIncidentEmail(data, categoryLabel) {
  const gps = data.gps || {};
  const reporter = data.reportedBy || {};
  const gpsLink = gps.lat ? 'https://www.google.com/maps?q=' + gps.lat + ',' + gps.lng : '';

  return '<div style="font-family:Arial,sans-serif;max-width:600px;">' +
    '<div style="background:#E97024;color:white;padding:16px;border-radius:8px 8px 0 0;">' +
      '<h2 style="margin:0;">' + categoryLabel + ' Report</h2>' +
    '</div>' +
    '<div style="padding:16px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;">' +
      '<p><strong>Job:</strong> ' + (data.jobId || 'Unknown') + '</p>' +
      '<p><strong>Category:</strong> ' + categoryLabel + '</p>' +
      '<p><strong>Description:</strong> ' + (data.description || 'No description') + '</p>' +
      '<p><strong>Reported by:</strong> ' + (reporter.name || reporter || 'Unknown') + '</p>' +
      '<p><strong>Time:</strong> ' + (data.timestamp || new Date().toISOString()) + '</p>' +
      (gpsLink ? '<p><strong>Location:</strong> <a href="' + gpsLink + '">' + gps.lat.toFixed(6) + ', ' + gps.lng.toFixed(6) + '</a></p>' : '') +
      '<hr style="border:none;border-top:1px solid #E5E7EB;margin:16px 0;">' +
      '<p style="color:#9C9586;font-size:12px;">Sent from SJ Traffic Site Checklist PWA</p>' +
    '</div>' +
  '</div>';
}

function buildEquipmentLossEmail(data, missing) {
  let rows = '';
  for (const [itemId, info] of Object.entries(missing)) {
    rows += '<tr>' +
      '<td style="padding:8px;border-bottom:1px solid #E5E7EB;">' + (info.label || itemId) + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #E5E7EB;text-align:center;">' + (info.taken || 0) + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #E5E7EB;text-align:center;">' + (info.returned || 0) + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #E5E7EB;text-align:center;color:#EF4444;font-weight:bold;">' + (info.lost || 0) + '</td>' +
    '</tr>';
  }

  return '<div style="font-family:Arial,sans-serif;max-width:600px;">' +
    '<div style="background:#EF4444;color:white;padding:16px;border-radius:8px 8px 0 0;">' +
      '<h2 style="margin:0;">Lost Equipment Report</h2>' +
    '</div>' +
    '<div style="padding:16px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;">' +
      '<p><strong>Job:</strong> ' + (data.jobId || 'Unknown') + '</p>' +
      '<p><strong>Client:</strong> ' + (data.client || 'Unknown') + '</p>' +
      '<p><strong>Project:</strong> ' + (data.project || '') + '</p>' +
      '<p><strong>Reported by:</strong> ' + (data.reportedBy || 'Unknown') + '</p>' +
      '<table style="width:100%;border-collapse:collapse;margin:16px 0;">' +
        '<thead><tr style="background:#F9FAFB;">' +
          '<th style="padding:8px;text-align:left;border-bottom:2px solid #E5E7EB;">Item</th>' +
          '<th style="padding:8px;text-align:center;border-bottom:2px solid #E5E7EB;">Taken</th>' +
          '<th style="padding:8px;text-align:center;border-bottom:2px solid #E5E7EB;">Returned</th>' +
          '<th style="padding:8px;text-align:center;border-bottom:2px solid #E5E7EB;">Lost</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '<p style="color:#EF4444;font-weight:bold;">Action required: Initiate invoice for lost materials.</p>' +
      '<hr style="border:none;border-top:1px solid #E5E7EB;margin:16px 0;">' +
      '<p style="color:#9C9586;font-size:12px;">Sent from SJ Traffic Site Checklist PWA</p>' +
    '</div>' +
  '</div>';
}

// GET handler — just returns status
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', app: 'SJ Traffic Site Checklist Sync v2' })
  ).setMimeType(ContentService.MimeType.JSON);
}
