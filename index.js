const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true // هينزل الـ QR Code في الـ Logs بتاعة Render
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('الاتصال انقطع، جاري إعادة الاتصال...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ تم الاتصال بالواتساب بنجاح!');
        }
    });
}

connectToWhatsApp();

// 1. Endpoint لإرسال كود الـ OTP
app.post('/send-otp', async (req, res) => {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'مطلوب رقم الهاتف والكود' });

    try {
        const formattedPhone = phone.replace(/\D/g, '') + '@s.whatsapp.net';
        await sock.sendMessage(formattedPhone, { 
            text: `🔐 كود التحقق الخاص بك لمنصة التعليم هو: *${otp}*\nالكود صالحة لمدة 5 دقائق فقط. لا تشاركه مع أحد.` 
        });
        res.json({ success: true, message: 'تم إرسال كود الـ OTP' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Endpoint لإرسال درجات الامتحانات لأولياء الأمور
app.post('/send-grade', async (req, res) => {
    const { parentPhone, studentName, examName, score, maxScore } = req.body;
    if (!parentPhone) return res.status(400).json({ error: 'مطلوب رقم ولي الأمر' });

    try {
        const formattedPhone = parentPhone.replace(/\D/g, '') + '@s.whatsapp.net';
        const msg = `📊 *تقرير درجات الطالب*\n\nولي الأمر المحترم، نحيطكم علماً بأن الطالب/ة: *${studentName}*\nقد حصل في اختبار (*${examName}*) على درجة: *${score} من ${maxScore}*.\n\nمع تحيات إدارة المنصة.`;
        await sock.sendMessage(formattedPhone, { text: msg });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Endpoint لإرسال إشعار المحاضرات الجديدة
app.post('/send-announcement', async (req, res) => {
    const { phone, courseName, lessonTitle } = req.body;
    try {
        const formattedPhone = phone.replace(/\D/g, '') + '@s.whatsapp.net';
        const msg = `📚 *تنبيه محاضرة جديدة!*\n\nتم نزول محاضرة جديدة بعنوان: *${lessonTitle}*\nفي كورس: *${courseName}*\n\nيمكنك الدخول للمنصة الآن لمشاهدة المحاضرة.`;
        await sock.sendMessage(formattedPhone, { text: msg });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`سيرفر الواتساب شغال على البورت ${PORT}`));
