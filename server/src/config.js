/**
 * Company profile printed on Purchase Orders and Invoices.
 * Replace the placeholders with the real GSTIN / PAN / bank details.
 * `state` decides GST type on invoices: same state -> CGST+SGST, otherwise IGST.
 */
module.exports = {
  company: {
    name: 'Flexibility Cloud Services Private Limited',
    address: ' Villa No 52, Tripura Landmark 2, Bowrampet, Dindigul, Rangareddy (K.V. Rangareddy), Telangana, 500043, India',
    state: 'Telangana',
    gstin: '36AAGCF1843D1ZX',
    pan: 'AAGCF1843D',
    email: 'operations.flexibilitycloud@gmail.com',
    phone: '+91 9182092380',
    bank: {
      name: 'YES BANK',
      accountName: 'Flixability Cloud Services Private Limited',
      accountNumber: '141526900000167',
      ifsc: 'YESB0001415',
    },
  },
  mail: {
    host: 'smtp.gmail.com',
    port: 587,
    user: 'operations.flexibilitycloud@gmail.com',
    pass: 'ooxzjiapnxgxnucs',
  },
  defaults: {
    invoiceGstPct: 18, // GST on training services
    poGstPct: 0, // most individual trainers are not GST registered
    poTdsPct: 10, // TDS u/s 194J (professional/technical fees)
    poTerms: 'Payment will be released within 15 days of training completion, subject to TDS as applicable.',
  },
};
