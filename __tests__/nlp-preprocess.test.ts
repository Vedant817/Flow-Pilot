import { buildClassifyInput, cleanEmailBody } from '../lib/nlp/preprocess';

describe('cleanEmailBody', () => {
  it('strips quoted reply lines and quote headers', () => {
    const body = [
      'Please postpone delivery to Monday.',
      '> On 25 Sep 2026, Sales wrote:',
      '> Your order is scheduled for Tuesday.',
    ].join('\n');
    expect(cleanEmailBody(body)).toBe('Please postpone delivery to Monday.');
  });

  it('cuts everything below an "On ... wrote:" header', () => {
    const body = [
      'Cancel 10 units please.',
      'On 20 Sep 2026, sales@example.com wrote:',
      'Here is our latest rate list.',
    ].join('\n');
    expect(cleanEmailBody(body)).toBe('Cancel 10 units please.');
  });

  it('removes signature blocks after a sign-off', () => {
    const body = [
      'Please send 60 packets of salt.',
      'Thanks and regards,',
      'Deepak Malhotra | Malhotra & Sons | 9811122233',
    ].join('\n');
    expect(cleanEmailBody(body)).toBe('Please send 60 packets of salt.');
  });

  it('drops legal disclaimer paragraphs', () => {
    const body = [
      'Please change the delivery date.',
      '',
      'This email is confidential and intended solely for the named recipient.',
    ].join('\n');
    expect(cleanEmailBody(body)).toBe('Please change the delivery date.');
  });

  it('keeps short bodies untouched', () => {
    expect(cleanEmailBody('Need 100 bags sugar urgently.')).toBe('Need 100 bags sugar urgently.');
  });
});

describe('buildClassifyInput', () => {
  it('prefixes the subject when present', () => {
    expect(buildClassifyInput('Call me to confirm.', 'New Order - 200 units')).toBe(
      'New Order - 200 units\nCall me to confirm.'
    );
  });

  it('falls back to body only when subject is missing', () => {
    expect(buildClassifyInput('Just a plain email.')).toBe('Just a plain email.');
  });
});
