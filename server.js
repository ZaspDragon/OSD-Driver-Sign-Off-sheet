import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import nodemailer from 'nodemailer'
import PDFDocument from 'pdfkit'
import { v4 as uuidv4 } from 'uuid'

dotenv.config()

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '25mb' })) // allow slightly larger payloads for PDF dataurls

const OUT_DIR = process.env.OUT_DIR || 'submissions'
fs.mkdirSync(OUT_DIR, { recursive: true })

app.get('/', (req, res) => res.send('OSD server running'))

app.post('/api/osd/submit', async (req, res) => {
  try {
    const data = req.body || {}
    const ref = uuidv4().slice(0, 8)
    const pdfPath = `${OUT_DIR}/OSD_${ref}.pdf`

    await buildPDF(data, pdfPath)

    const attachments = [{ filename: `OSD_${ref}.pdf`, path: pdfPath }]

    // If a BOL PDF was uploaded, save and attach it as well
    if (data.bolPdfDataUrl) {
      try {
        const base64 = data.bolPdfDataUrl.split(',')[1]
        const buf = Buffer.from(base64, 'base64')
        const bolPdfPath = `${OUT_DIR}/OSD_${ref}_BOL.pdf`
        fs.writeFileSync(bolPdfPath, buf)
        attachments.push({ filename: `BOL_${ref}.pdf`, path: bolPdfPath })
      } catch (e) { console.warn('Failed to save bolPdfDataUrl:', e.message) }
    }

    // Email the PDFs (if SMTP configured)
    let mailInfo = null
    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      })

      // allow frontend to route email dynamically (fallback to NOTIFY_TO/SMTP_USER)
      const to = (data.toEmail && data.toEmail.trim()) || process.env.NOTIFY_TO || process.env.SMTP_USER
      const cc = data.ccEmail || ''
      const bcc = data.bccEmail || ''
      const subject = data.subject || `OSD Sign-Off ${ref}`
      const text = (data.message && String(data.message)) ||
        `New OSD submission ${ref} from ${data.driverName || 'Driver'} at ${data.location || ''}.`

      mailInfo = await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to, cc, bcc, subject, text,
        attachments
      })
    }

    res.json({ ok: true, ref, mailed: !!mailInfo })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log('Server on', PORT))

async function buildPDF(data, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    doc.fontSize(20).text('OSD – Driver Sign-Off')
    doc.moveDown(0.5)
    doc.fontSize(10).fillColor('#475569').text(`Generated: ${new Date().toLocaleString()}`)
    doc.moveDown()
    doc.fillColor('#0f172a')

    const row = (label, value='') => {
      doc.font('Helvetica-Bold').text(label, { continued: true })
      doc.font('Helvetica').text(' ' + (value || ''))
    }

    row('Date/Time:', fmtDate(data.date))
    row('Location:', data.location)
    row('Load ID / BOL #:', data.bol)
    row('PO Number:', data.po)
    row('Digital BOL Link / Load #:', data.bolLink)
    row('Stop #:', data.stop)
    row('Carrier:', data.carrier)
    row('Vendor ID:', data.vendorId)
    row('Vendor Name:', data.vendorName)
    row('Trailer #:', data.trailerNumber)

    // BOL image if provided
    if (data.bolPhotoDataUrl) {
      try {
        const base64 = data.bolPhotoDataUrl.split(',')[1]
        const buf = Buffer.from(base64, 'base64')
        doc.moveDown()
        doc.font('Helvetica-Bold').text('BOL Image')
        doc.image(buf, { fit: [520, 360], align: 'center' })
      } catch {}
    }

    if (data.bolPdfDataUrl) {
      doc.moveDown()
      doc.font('Helvetica').text('BOL PDF provided (attached to email).')
    }

    doc.moveDown()
    doc.font('Helvetica-Bold').text('Notes / Exceptions')
    doc.font('Helvetica').text(data.notes || '(none)')
    doc.moveDown()

    doc.font('Helvetica-Bold').text('Driver Name: ', { continued: true })
    doc.font('Helvetica').text(data.driverName || '')
    doc.font('Helvetica-Bold').text('Driver ID / PRO: ', { continued: true })
    doc.font('Helvetica').text(data.driverId || '')
    doc.moveDown(0.5)

    if (data.signatureDataUrl) {
      try {
        const base64 = data.signatureDataUrl.split(',')[1]
        const buf = Buffer.from(base64, 'base64')
        doc.text('Signature:')
        doc.image(buf, { fit: [420, 120] })
      } catch { doc.text('(signature failed to render)') }
    } else {
      doc.text('(no signature provided)')
    }

    if (Array.isArray(data.photos) && data.photos.length) {
      doc.addPage().font('Helvetica-Bold').fontSize(16).text('Photos')
      doc.moveDown()
      for (const p of data.photos) {
        const b64 = (p.dataUrl || '').split(',')[1]
        if (!b64) continue
        const img = Buffer.from(b64, 'base64')
        try { doc.image(img, { fit: [520, 280], align: 'center' }) } catch {}
        doc.moveDown()
      }
    }

    doc.end()
    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}

function fmtDate(s) { try { return new Date(s).toLocaleString() } catch { return '' } }
