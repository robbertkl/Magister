'use strict';

const nodemailer = require('nodemailer');

if (!process.env.SENDER || !process.env.RECIPIENTS) {
  console.error('Error: Environment variable SENDER and/or RECIPIENTS are not set; exiting...');
  process.exit(1);
}

const recipients = process.env.RECIPIENTS.split(/\s*,\s*/);
const sender = process.env.SENDER;
const mailer = nodemailer.createTransport({ host: 'mail', port: 587, ignoreTLS: true });

if (!process.env.MAGISTER_SCHOOL || !process.env.MAGISTER_USERNAME || !process.env.MAGISTER_PASSWORD) {
  console.error('Error: MAGISTER_ environment variables are not set; exiting...');
  process.exit(1);
}

const credentials = {
  school: process.env.MAGISTER_SCHOOL,
  username: process.env.MAGISTER_USERNAME,
  password: process.env.MAGISTER_PASSWORD,
};

let shouldExitAfterFirstCheck = false;
let options = {};

if (process.argv.length >= 3) {
  options.startDate = new Date(process.argv[2]);
  options.interval = -1;
}

let gradeNotifier = require('.')(credentials, options);

gradeNotifier.on('error', function(error) {
  logError(error);
  if (options.interval < 0) process.exit(1);
});

gradeNotifier.on('grade', function(grade) {
  logInfo('Found grade');

  const color = grade.isPass ? '#3fca02' : '#e0311f';

  const htmlText =
    `Je hebt voor ${grade.className} het volgende cijfer gehaald:<br><br>` +
    `<font size="96" color="${color}">${grade.grade.toString().replace('.', ',')}</font><br>` +
    (grade.description ? `(${grade.description})<br>` : '') +
    '<br>' +
    `Dit cijfer telt ${grade.weight} keer mee.<br>` +
    `Voor ${grade.className} sta je nu een ${grade.classAverage} en je eindgemiddelde is een ${grade.overallAverage.toString().replace('.', ',')}.<br>` +
    `VWO tussenstand: ${grade.overallPoints}/74 punten.<br>`;

  const plainText = htmlText.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');

  recipients.forEach(function (recipient) {
    const mailOptions = {
      to: recipient,
      from: sender,
      subject: `Nieuw cijfer voor ${grade.className}`,
      text: plainText,
      html: htmlText,
    };

    mailer.sendMail(mailOptions, function(error, info) {
      if (error) return logError(error, `sending mail to ${recipient}`);
      logInfo(`Mail sent to ${recipient}: ${info.response}`);
    });
  });
});

function logInfo(message) {
  console.log(`${new Date().toISOString()} - ${message}`);
}

function logError(error, action) {
  let header = action ? `Error ${action}:` : 'Error:';
  console.error(`${new Date().toISOString()} - ${header} ${error.message}`);
}
