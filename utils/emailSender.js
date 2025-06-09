const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const ErrorResponse = require('./errorResponse');

// Helper function to load and populate HTML templates
const loadTemplate = (templateName, data) => {
  const templatePath = path.join(__dirname, 'emailTemplates', `${templateName}.html`);
  if (!fs.existsSync(templatePath)) {
    throw new ErrorResponse(`Email template ${templateName}.html not found`, 404);
  }
  let html = fs.readFileSync(templatePath, 'utf-8');

  // Replace placeholders
  for (const key in data) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, data[key]);
  }
  // Add year and company name by default
  html = html.replace(/{{year}}/g, new Date().getFullYear());
  html = html.replace(/{{companyName}}/g, 'Event Loop');


  return html;
};

const sendEmail = async options => {
  // 1) Create a transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // 2) Define the email options
  const mailOptions = {
    from: 'Event Loop <noreply@eventloop.com>', // Updated sender name
    to: options.email,
    subject: options.subject,
    text: options.message // Fallback for email clients that don't support HTML
  };

  // If a template is specified, load and use it
  if (options.template) {
    try {
      mailOptions.html = loadTemplate(options.template, options.templateData || {});
    } catch (error) {
      console.error('Error loading email template:', error);
      // Optionally, send a plain text email as a fallback or throw an error
      // For now, we'll proceed with plain text if template loading fails and html is not set
      if (!mailOptions.html && !options.html) { // only use text if no html was provided by options.html either
          // keep mailOptions.text as is
      } else if (options.html) { // if options.html was provided, use that
          mailOptions.html = options.html;
      }
      // If you want to ensure HTML email or fail, you might throw the error:
      // throw new ErrorResponse(`Failed to load email template: ${options.template}`, 500);
    }
  } else if (options.html) {
    // Allow passing raw HTML directly
    mailOptions.html = options.html;
  }


  // 3) Actually send the email
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email: ', error);
    throw new ErrorResponse('Email could not be sent', 500);
  }
};

module.exports = sendEmail;