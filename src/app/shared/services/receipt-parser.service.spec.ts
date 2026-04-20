import { ReceiptParserService, ParsedReceipt } from './receipt-parser.service';

describe('ReceiptParserService', () => {
  let service: ReceiptParserService;

  beforeEach(() => {
    service = new ReceiptParserService();
  });

  // ── Empty / invalid input ──

  describe('parse – empty / invalid input', () => {
    it('should return empty result for null body', () => {
      const r = service.parse(null);
      expect(r.total).toBeNull();
      expect(r.items).toEqual([]);
      expect(r.comment).toBe('');
    });

    it('should return empty result for body with no receipts', () => {
      const r = service.parse({ receipts: [] });
      expect(r.total).toBeNull();
    });

    it('should return empty result for body without receipts key', () => {
      const r = service.parse({ success: true });
      expect(r.total).toBeNull();
    });
  });

  // ── Paradise ──

  describe('Paradise reader', () => {
    const paradiseOcr = `            FRISCHE PARADIES
                  NL München Schlachthof
              Zenettistraße 10e 80337 München
                MO FR: 08:00- 19:00 Uhr
                   SA: 08:00 -19:00 Uhr
  Kunde: 0801000000 Barverkauf
 988587 LINGUINE 3MM FR GDS.1KG      1,0 ST     6,99
 256780 EPI BROT PREM.350G           1,0 ST     3,99
          MHD                       20,00%     -0,80
 274644 BRUSCHETTA IT PAN 400G       1,0 ST     2,99
 67361 LATTELLA MARACUJA 500ML       1,0 ST     1,49
 290003 BUTTER OCCELLI IT 125G       1,0 ST     4,69
 59201    MEERSALZBUTTER PAYS.250G 1,0 ST       3,99
 808877 BIO HEUM.JOGH.ZITR.3,6%4 1,0 ST         4,79
          MHD                       20,00%     -0,96
 353564 EIFIX KONDITOR EIWEIẞ BOH 1,0 ST        7,99
 463529 GOLDFORELLE AUSG.QSFP 250 1,0 kg
 Gewicht manuell eingegeben
        0.5 kg X 28,90 EUR/kg                  14.45
 265573 GLEN DOUGL.LACHSFIL.OSFPC 1,0 kg
 Gewicht manuell eingegeben
      0.302 kg X 59,90 EUR /kg                 18,09
 513114 ERDBEERE KL. 500G POLEN 1,0 ST 7,80
         Wochenend-Highlight                    1,81
 574578 CHAMP. BRAUN KL.I 15-45 NI 1,0 kg
 Gewicht manuell eingegeben
      0.144 kg X 6,49 EUR/kg                    0,93
 Summe EUR                                 74,62
 Mastercard                                    74,62`;

    const body = { receipts: [{ merchant_name: 'NL München Schlachthof', total: 74.62, date: null, time: null, ocr_text: paradiseOcr }] };

    it('should detect Paradise and set merchant', () => {
      const r = service.parse(body);
      expect(r.merchant).toBe('Frische Paradies');
    });

    it('should extract address', () => {
      const r = service.parse(body);
      expect(r.street).toContain('Zenettistraße');
      expect(r.place).toBe('80337 München');
    });

    it('should extract correct total', () => {
      expect(service.parse(body).total).toBe(74.62);
    });

    it('should not pick up store opening hours as time', () => {
      expect(service.parse(body).time).toBeNull();
    });

    it('should extract items with prices', () => {
      const r = service.parse(body);
      expect(r.items.length).toBeGreaterThan(5);

      const linguine = r.items.find(i => /linguine/i.test(i.name));
      expect(linguine).toBeDefined();
      expect(linguine!.price).toBe(6.99);
    });

    it('should handle MHD discount by adjusting price', () => {
      const r = service.parse(body);
      // EPI BROT (3.99) has MHD -0.80 → 3.19
      const epi = r.items.find(i => /epi brot/i.test(i.name));
      expect(epi).toBeDefined();
      expect(epi!.price).toBe(3.19);
      expect(epi!.info).toContain('Rabatt');
    });

    it('should handle weight items with kg price', () => {
      const r = service.parse(body);
      const forelle = r.items.find(i => /goldforelle/i.test(i.name));
      expect(forelle).toBeDefined();
      expect(forelle!.price).toBe(14.45);
      expect(forelle!.info).toContain('kg');
      expect(forelle!.info).toContain('28,90');
    });

    it('should format comment with header and items', () => {
      const r = service.parse(body);
      expect(r.comment).toContain('Frische Paradies');
      expect(r.comment).toContain('---');
      expect(r.comment).toContain('6,99');
    });
  });

  // ── go asia ──

  describe('go asia reader', () => {
    const goAsiaOcr = `                  go asia
            go asia Supermarkt
          Stachus-Passagen, 80335 München
                  089/51 26 65 56
  Rechnung
  Beleg-Nr.: 100337923
  Datum: 30.03.2026 Zeit: 12:11:32
  Kasse: 570 Kassierer in: 2338
  Kunden-Nr.: 10005MUC2
  Kunden 10%München 02
  Nr.    Artikel
                                          EUR
  80193 TK Sui Kau mit Garnelen 18*15g    5,99 A
         DELICO 超群 广东 水饺 (中)
  2715  NK Verpackter Tofu natur 450g T   1,79 A
        REIBER 包装 硬 豆腐
 59629 TK Koreanische Pancake Kimchi      4,59 A
        300g KFS KFS
 73144 KOKUSANMAI HON Mirin 400ml         5,69 B
        HINODE 日出 本 味
  60771 TK Unagi Kabayaki Aal 250g       12,99 A
        鳗鱼
 60771 TK Unagi Kabayaki Aal 250g        12,99 A
        鳗鱼
  74392 TK Fischkuchen im Scallopform     2,99 A
        200g LLC 乐乐 干贝 形 鱼 豆腐
  54997 Konjak Snack BBQ 54g MOWON        1,09 A
        大 魔王 魔芋 素 毛肚 烧烤 味
 2717   NK Sezuan Tofu 200g TREIBER       2,99 A
        麻辣 豆腐
 59764 TK Quadratischer Fischkuchen m     5,99 A
        it Gemüse 300g GORAESA
        方形 蔬菜 鱼饼
 58405 TK Gebratene Nudeln m. Garnel     7,99 A
        en & Trüffel 450g MAYRAIN
        松露 虾仁 炒面
 58402 TK Goyza mit Pilz 400g MAYRAI      7,99 A
          美 润 珍 菌素 蒸 煎饺
 55119 Getrockneter Mandelpilz 100g C     5,09 A
        HUXINYUAN 楚 心 园 姬松茸
 55118 Getrockneter Steinpilz 80g CHU     5,94 A
        XINYUAN 楚 心 园 牛肝菌
 60957 Azukibohnen 400g LELECHU R         2,99 A
        乐 厨 红豆
 54996 Konjak Snack Sesampaste schar      2,79 A
        f206g MOWON 大 魔王 魔芋 素 毛肚 香
        辣 麻酱 味
 77445 Marinierte Lotuswurzelscheiben     1,79 A
        Ente 100g YUMEI
 55106 Shiitakepilz 100g CHUXINYUAN       4,24 A
        楚 心 园 花菇
 1289  Chinesisches Bapao Weizenmeh       4,99 A
         1kg 大白菜 面粉
 Summe vor Rabatt                       100,91
 Rabatt 10,00%
                                          5.58
 SUMME               EUR
                                         95,33
 Kartenzahlung                           95,33`;

    const body = { receipts: [{ merchant_name: 'go asia Supermarkt', total: 100.91, date: '2026-03-30', time: null, ocr_text: goAsiaOcr }] };

    it('should detect go asia and set merchant', () => {
      expect(service.parse(body).merchant).toBe('go asia Supermarkt');
    });

    it('should extract address', () => {
      const r = service.parse(body);
      expect(r.street).toContain('Stachus-Passagen');
      expect(r.place).toBe('80335 München');
    });

    it('should extract post-discount total (95.33, not 100.91)', () => {
      expect(service.parse(body).total).toBe(95.33);
    });

    it('should extract date from "Datum: 30.03.2026"', () => {
      expect(service.parse(body).date).toBe('2026-03-30');
    });

    it('should extract time from "Zeit: 12:11:32"', () => {
      expect(service.parse(body).time).toBe('12:11');
    });

    it('should extract all 19 items', () => {
      const r = service.parse(body);
      expect(r.items.length).toBe(19);
    });

    it('should capture CJK info lines', () => {
      const r = service.parse(body);
      const sui = r.items.find(i => /Sui Kau/i.test(i.name));
      expect(sui).toBeDefined();
      expect(sui!.price).toBe(5.99);
      expect(sui!.info).toContain('DELICO');
    });

    it('should capture multi-line continuation info', () => {
      const r = service.parse(body);
      const fischkuchen = r.items.find(i => /Quadratischer Fischkuchen/i.test(i.name));
      expect(fischkuchen).toBeDefined();
      expect(fischkuchen!.info).toContain('Gemüse');
    });
  });

  // ── REWE ──

  describe('REWE reader', () => {
    const reweOcr = `               REWE
         Sankt-Magnus-Str. 32
            81545 München
         UID Nr.: DE812706034
                                   EUR
 CHINAKOHL BY                     2,73 B
  1,098 kg x 2,49 EUR/kg
 ORANGE                           1,46 B
  0,406 kg x 3,59 EUR/kg
 PULPOARME GEK.                   9,99 B
 LACHS NATUR                      5,79 B
 MOZZARELLA                       3,98 B
  2 Stk x     1,99
 EMMENTALER GER.                  2,69 B
 KERRYGOLD CHEDD.                 2,99 B
 DINKEL SANDWICH                  1,99 B
 AVOCADO FEINE W.                 2,79 B
 KNOBLAUCH                        1,29 B
 SALATGURKE                       0,66 B
 CHAMPIGNONS                      1,99 B
 KOCH-CREME 7%                    1,39 B
 JOGHURT MILDO, 1%                0,99 B
 HIMB. -HEIDELB. MX               2,99 B
 SUMME                   EUR     43,72
 Geg. Mastercard         EUR     43,72
           ** Kundenbeleg **
 Datum:                        13.04.2026
 Uhrzeit:                    17:32:21 Uhr
 Beleg-Nr.                           8556
 Trace-Nr.                         057008
                 Bezahlung
                Contactless
              DEBIT MASTERCARD`;

    const body = { receipts: [{ merchant_name: 'CHINAKOHL BY', total: 43.72, date: '2026-04-13', time: null, ocr_text: reweOcr }] };

    it('should detect REWE and override wrong API merchant name', () => {
      expect(service.parse(body).merchant).toBe('REWE');
    });

    it('should extract street and place', () => {
      const r = service.parse(body);
      expect(r.street).toContain('Sankt-Magnus-Str');
      expect(r.place).toBe('81545 München');
    });

    it('should extract correct total', () => {
      expect(service.parse(body).total).toBe(43.72);
    });

    it('should extract date', () => {
      expect(service.parse(body).date).toBe('2026-04-13');
    });

    it('should extract time', () => {
      expect(service.parse(body).time).toBe('17:32');
    });

    it('should extract 15 items', () => {
      expect(service.parse(body).items.length).toBe(15);
    });

    it('should attach weight info to CHINAKOHL', () => {
      const r = service.parse(body);
      const chinakohl = r.items.find(i => /chinakohl/i.test(i.name));
      expect(chinakohl).toBeDefined();
      expect(chinakohl!.price).toBe(2.73);
      expect(chinakohl!.info).toContain('1,098 kg');
      expect(chinakohl!.info).toContain('2,49');
    });

    it('should attach quantity info to MOZZARELLA', () => {
      const r = service.parse(body);
      const mozz = r.items.find(i => /mozzarella/i.test(i.name));
      expect(mozz).toBeDefined();
      expect(mozz!.price).toBe(3.98);
      expect(mozz!.info).toContain('2');
      expect(mozz!.info).toContain('1,99');
    });

    it('should format comment with REWE header', () => {
      const r = service.parse(body);
      expect(r.comment).toMatch(/^REWE/);
      expect(r.comment).toContain('---');
      expect(r.comment).toContain('CHINAKOHL BY');
    });
  });

  // ── EDEKA ──

  describe('EDEKA reader', () => {
    const edekaOcr = `                E
                EDEKA
          Wolfram Niggel e.K.
         Oberbiberger Straße 1
             81547 München
          Tel. 089, 69341913
              www.edeka.de
                                 EUR
 Mühl.Basis-Müsli               3,99 A
 Schär Löffelbis.               4,19 A
 Chiquita Bananen               1,59 A
    0,590 kg x 2,69 €/kg
 Kult.Heidelb.                  4,99 A
 Spont.Badputzer                2,29 B
 Bio RUF Gelantine              1,99 A
 Herz.Van.scho 2,99 € x 2 5,98 A
 Posten: 8
 SUMME €                    25,02
 Mastercard                    25,02`;

    const body = { receipts: [{ merchant_name: 'EDEKA', total: 25.02, date: null, time: null, ocr_text: edekaOcr }] };

    it('should detect EDEKA', () => {
      expect(service.parse(body).merchant).toBe('EDEKA');
    });

    it('should extract street and place', () => {
      const r = service.parse(body);
      expect(r.street).toContain('Oberbiberger');
      expect(r.place).toBe('81547 München');
    });

    it('should extract correct total', () => {
      expect(service.parse(body).total).toBe(25.02);
    });

    it('should return null date when not on receipt', () => {
      expect(service.parse(body).date).toBeNull();
    });

    it('should extract items', () => {
      const r = service.parse(body);
      expect(r.items.length).toBeGreaterThanOrEqual(6);
    });

    it('should handle weight info for Chiquita Bananen', () => {
      const r = service.parse(body);
      const bananen = r.items.find(i => /bananen/i.test(i.name));
      expect(bananen).toBeDefined();
      expect(bananen!.price).toBe(1.59);
      expect(bananen!.info).toContain('0,590 kg');
    });

    it('should handle multi-buy "2,99 € x 2" for Herz.Van.scho', () => {
      const r = service.parse(body);
      const herz = r.items.find(i => /herz\.van/i.test(i.name));
      expect(herz).toBeDefined();
      expect(herz!.price).toBe(5.98);
      expect(herz!.info).toContain('2');
      expect(herz!.info).toContain('2,99');
    });
  });

  // ── Generic reader ──

  describe('Generic reader', () => {
    it('should extract total from "Zu zahlen" keyword', () => {
      const body = { receipts: [{ total: 15.50, ocr_text: 'Store\nItem  5,00\nZu zahlen  15,50' }] };
      expect(service.parse(body).total).toBe(15.50);
    });

    it('should check next line for amount when keyword line has no amount', () => {
      const body = { receipts: [{ total: 50.00, ocr_text: 'Store\nSUMME  EUR\n  50,00' }] };
      expect(service.parse(body).total).toBe(50.00);
    });

    it('should fall back to API total when no keyword found', () => {
      const body = { receipts: [{ total: 33.33, ocr_text: 'Store\nItem  33,33' }] };
      expect(service.parse(body).total).toBe(33.33);
    });

    it('should use API data as fallback when no ocr_text', () => {
      const body = { receipts: [{
        merchant_name: 'Fallback Store', merchant_address: 'Main St 1, 80337 München',
        total: 10.00, date: '2026-01-01', time: '14:30', ocr_text: '',
        items: [{ description: 'Apple', amount: 3.00 }, { description: 'Banana', amount: 7.00 }]
      }] };
      const r = service.parse(body);
      expect(r.merchant).toBe('Fallback Store');
      expect(r.street).toContain('Main St');
      expect(r.place).toContain('80337');
      expect(r.items.length).toBe(2);
      expect(r.items[0].name).toBe('Apple');
    });

    it('should extract merchant from first meaningful OCR line', () => {
      const body = { receipts: [{ total: 5.00, ocr_text: 'My Store\nMain Str. 1\n81545 München\nItem  5,00 A\nSumme  5,00' }] };
      const r = service.parse(body);
      expect(r.merchant).toBe('My Store');
      expect(r.street).toContain('Main Str');
      expect(r.place).toContain('81545');
    });

    it('should extract items with detail lines', () => {
      const body = { receipts: [{ total: 5.00, ocr_text: `Store
                     EUR
Product A              3,00 B
  0,500 kg x 6,00
Product B              2,00 B
Summe  5,00` }] };
      const r = service.parse(body);
      expect(r.items.length).toBe(2);
      expect(r.items[0].name).toBe('Product A');
      expect(r.items[0].info).toContain('0,500 kg');
    });
  });

  // ── Helper methods ──

  describe('extractDate', () => {
    it('should extract German date DD.MM.YYYY', () => {
      expect(service.extractDate('Datum: 13.04.2026')).toBe('2026-04-13');
    });

    it('should extract ISO date YYYY-MM-DD', () => {
      expect(service.extractDate('Date: 2026-04-13')).toBe('2026-04-13');
    });

    it('should reject dates outside valid range', () => {
      expect(service.extractDate('Date: 01.01.2019')).toBeNull();
    });

    it('should return null for no date', () => {
      expect(service.extractDate('No date here')).toBeNull();
    });
  });

  describe('extractTime', () => {
    it('should extract time from "Zeit: 12:11:32"', () => {
      expect(service.extractTime('Datum: 30.03.2026 Zeit: 12:11:32')).toBe('12:11');
    });

    it('should extract time from "Uhrzeit: 17:32:21 Uhr"', () => {
      expect(service.extractTime('Uhrzeit:                    17:32:21 Uhr')).toBe('17:32');
    });

    it('should not pick up store opening hours', () => {
      expect(service.extractTime('MO FR: 08:00- 19:00 Uhr\nSA: 08:00 -19:00 Uhr')).toBeNull();
    });

    it('should return null when no time marker present', () => {
      expect(service.extractTime('No time info here')).toBeNull();
    });
  });

  describe('extractAmount', () => {
    it('should extract amount with comma decimal', () => {
      expect(service.extractAmount('SUMME EUR  43,72')).toBe(43.72);
    });

    it('should extract amount with dot decimal', () => {
      expect(service.extractAmount('Total  95.33')).toBe(95.33);
    });

    it('should take the last amount on the line', () => {
      expect(service.extractAmount('2 Stk x 1,99  3,98')).toBe(3.98);
    });

    it('should return null for line without amounts', () => {
      expect(service.extractAmount('No amounts here')).toBeNull();
    });
  });

  describe('formatComment', () => {
    it('should produce header + separator + items', () => {
      const parsed: ParsedReceipt = {
        merchant: 'TestStore', street: 'Main St 1', place: '80337 München',
        total: 10.00, date: null, time: null,
        items: [
          { name: 'Apple', price: 3.50, info: '' },
          { name: 'Milk', price: 1.99, info: '2 × 0,99' }
        ],
        comment: ''
      };
      const comment = service.formatComment(parsed);
      expect(comment).toBe('TestStore\nMain St 1\n80337 München\n---\nApple  3,50\nMilk  1,99\n  2 × 0,99');
    });

    it('should skip empty fields', () => {
      const parsed: ParsedReceipt = {
        merchant: 'Store', street: '', place: '',
        total: null, date: null, time: null,
        items: [{ name: 'Item', price: 1.00, info: '' }],
        comment: ''
      };
      const comment = service.formatComment(parsed);
      expect(comment).toBe('Store\n---\nItem  1,00');
    });
  });
});
