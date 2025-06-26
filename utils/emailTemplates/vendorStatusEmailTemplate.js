const vendorStatusEmailTemplate = ({ vendorName, isApproved, companyLogoUrl }) => {
  const statusText = isApproved ? 'approved' : 'rejected';
  const statusColor = isApproved ? '#28a745' : '#dc3545';

  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <div style="background-color: #ffffff; text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px; height: auto;" />
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="color: #333;">Hello ${vendorName || 'Vendor'},</h2>
          <p style="font-size: 16px;">
            We wanted to inform you that your vendor account has been 
            <strong style="color: ${statusColor}; text-transform: uppercase;">${statusText}</strong> 
            by our admin team.
          </p>
          <p style="font-size: 16px;">
            ${isApproved 
              ? 'You can now access your vendor dashboard and start managing your services.' 
              : 'Unfortunately, your account didn’t meet our approval criteria at this time. You may contact support for further details.'}
          </p>
          <p style="font-size: 14px; color: #555;">Thank you for your interest in partnering with us.</p>
          <p style="font-size: 14px; color: #555;">— The Team</p>
        </div>
        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = vendorStatusEmailTemplate;
