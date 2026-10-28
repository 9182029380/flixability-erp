/**
 * Demo data. Dates are relative to "today" so the dashboard always looks alive.
 * Run `npm run seed` to wipe the database and load this data again.
 * Company names below are fictional.
 */
const db = require('./db');
const s = require('./services');

function run() {
  process.env.SMTP_DISABLED = process.env.SMTP_DISABLED || 'true';
  const t = s.today();
  const day = (n) => s.addDays(t, n);

  const trainer = (o) => s.createEntity('trainers', o);
  const client = (o) => s.createEntity('clients', o);
  const training = (o) => s.createEntity('trainings', o);

  const anita = trainer({ name: 'Anita Rao', email: 'anita.rao@example.com', phone: '+91 98450 00001', expertise: 'Leadership & Soft Skills', city: 'Bengaluru', pan: 'ABCPR1234A', bankName: 'ICICI Bank', accountNumber: '000123456789', ifsc: 'ICIC0000001', ratePerDay: 35000 });
  const rahul = trainer({ name: 'Rahul Menon', email: 'rahul.menon@example.com', phone: '+91 98450 00002', expertise: 'Data Analytics & AI', city: 'Hyderabad', pan: 'ABCPM5678B', bankName: 'HDFC Bank', accountNumber: '000987654321', ifsc: 'HDFC0000002', ratePerDay: 45000 });
  const sneha = trainer({ name: 'Sneha Kulkarni', email: 'sneha.k@example.com', phone: '+91 98450 00003', expertise: 'Agile & Scrum', city: 'Pune', pan: 'ABCPK9012C', bankName: 'Axis Bank', accountNumber: '000555666777', ifsc: 'UTIB0000003', ratePerDay: 30000 });
  const vikram = trainer({ name: 'Vikram Iyer', email: 'vikram.iyer@example.com', phone: '+91 98450 00004', expertise: 'Cloud & DevOps', city: 'Chennai', pan: 'ABCPI3456D', bankName: 'SBI', accountNumber: '000444333222', ifsc: 'SBIN0000004', ratePerDay: 40000 });

  const zenith = client({ name: 'Zenith Software Pvt Ltd', contactPerson: 'Meera Nair', email: 'learning@zenith.example', phone: '+91 80 4000 0001', gstin: '29AAAAZ0000A1Z5', state: 'Karnataka', address: 'Whitefield, Bengaluru', paymentTermsDays: 30 });
  const orbit = client({ name: 'Orbit Financial Services', contactPerson: 'Karan Shah', email: 'hr@orbit.example', phone: '+91 22 4000 0002', gstin: '27AAAAO0000A1Z5', state: 'Maharashtra', address: 'BKC, Mumbai', paymentTermsDays: 45 });
  const nova = client({ name: 'Nova Pharma Ltd', contactPerson: 'Divya Reddy', email: 'ld@novapharma.example', phone: '+91 40 4000 0003', gstin: '36AAAAN0000A1Z5', state: 'Telangana', address: 'Genome Valley, Hyderabad', paymentTermsDays: 30 });
  const blue = client({ name: 'BlueWave Retail', contactPerson: 'Arjun Pillai', email: 'people@bluewave.example', phone: '+91 44 4000 0004', gstin: '33AAAAB0000A1Z5', state: 'Tamil Nadu', address: 'T Nagar, Chennai', paymentTermsDays: 30 });

  const mk = (title, c, tr, start, days, mode, trFee, clFee, status, participants = 25) =>
    training({ title, clientId: c.id, trainerId: tr?.id, startDate: day(start), endDate: day(start + days - 1), days, mode, venue: mode === 'ONLINE' ? 'MS Teams' : c.address, participants, trainerFee: trFee, clientFee: clFee, status });

  const t1 = mk('Leadership Essentials for First-time Managers', zenith, anita, -150, 3, 'ONSITE', 105000, 165000, 'COMPLETED');
  const t2 = mk('Python for Data Analysis', orbit, rahul, -120, 5, 'ONLINE', 225000, 340000, 'COMPLETED');
  const t3 = mk('Agile & Scrum Master Bootcamp', nova, sneha, -90, 2, 'ONSITE', 60000, 98000, 'COMPLETED');
  const t4 = mk('AWS Cloud Practitioner Workshop', blue, vikram, -60, 4, 'HYBRID', 160000, 245000, 'COMPLETED');
  const t5 = mk('Communication & Presentation Skills', zenith, anita, -30, 2, 'ONSITE', 70000, 110000, 'COMPLETED');
  const t6 = mk('Generative AI for Business Leaders', orbit, rahul, -10, 2, 'ONLINE', 90000, 150000, 'COMPLETED');
  const t7 = mk('DevOps & CI/CD Fundamentals', nova, vikram, 12, 3, 'ONLINE', 120000, 185000, 'CONFIRMED');
  mk('Design Thinking for Product Teams', blue, null, 30, 2, 'ONSITE', 0, 120000, 'PLANNED');

  const pay = (po, amt, ago, mode = 'NEFT') => s.payTrainer(po.id, { amount: amt, date: day(-ago), mode, reference: 'UTR' + Math.floor(Math.random() * 1e9) });
  const recv = (inv, amt, tds, ago) => s.receivePayment(inv.id, { amount: amt, tdsDeducted: tds, date: day(-ago), mode: 'NEFT', reference: 'UTR' + Math.floor(Math.random() * 1e9) });

  // Purchase orders + trainer payments
  const poFor = async (tr, offset, extra) => {
    const po = s.createPO({ trainingId: tr.id, poDate: day(offset), ...extra });
    return s.sendPO(po.id);
  };
  return (async () => {
    const po1 = await poFor(t1, -155);
    pay(po1, po1.net, 120);
    const po2 = await poFor(t2, -125);
    pay(po2, po2.net, 85);
    const po3 = await poFor(t3, -95);
    pay(po3, po3.net, 60);
    const po4 = await poFor(t4, -65);
    pay(po4, 100000, 30);
    const po5 = await poFor(t5, -35);
    pay(po5, po5.net, 12);
    await poFor(t6, -12);
    s.createPO({ trainingId: t7.id, poDate: day(-1) }); // draft, not yet sent

    // Invoices + client receipts
    const invFor = async (tr, offset, extra) => {
      const inv = s.createInvoice({ trainingId: tr.id, invoiceDate: day(offset), ...extra });
      return s.sendInvoice(inv.id);
    };
    const i1 = await invFor(t1, -145);
    recv(i1, i1.total - i1.subtotal * 0.1, i1.subtotal * 0.1, 105);
    const i2 = await invFor(t2, -115);
    recv(i2, i2.total - i2.subtotal * 0.1, i2.subtotal * 0.1, 60);
    const i3 = await invFor(t3, -85);
    recv(i3, 60000, 0, 40);
    await invFor(t4, -55); // outstanding, overdue
    const i5 = await invFor(t5, -25);
    recv(i5, 50000, 0, 5);
    await invFor(t6, -8);
    console.log('Seed complete');
  })();
}

module.exports = { run };

if (require.main === module) {
  if (process.argv.includes('--reset')) db.reset();
  else db.load();
  run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
