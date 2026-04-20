import { Injectable } from '@angular/core';

export interface ReceiptItem {
  name: string;
  price: number | null;
  info: string;       // quantity, weight, unit price, discount etc.
}

export interface ParsedReceipt {
  merchant: string;
  street: string;
  place: string;
  total: number | null;
  date: string | null;   // YYYY-MM-DD
  time: string | null;   // HH:MM
  items: ReceiptItem[];
  comment: string;       // formatted output for display
}

@Injectable({ providedIn: 'root' })
export class ReceiptParserService {

  parse(body: any): ParsedReceipt {
    const empty: ParsedReceipt = {
      merchant: '', street: '', place: '',
      total: null, date: null, time: null,
      items: [], comment: ''
    };
    if (!body?.receipts?.length) return empty;

    const receipt = body.receipts[0];
    const ocrText: string = receipt.ocr_text || '';

    let parsed: ParsedReceipt;
    if (this.isParadise(ocrText))       parsed = this.parseParadise(receipt, ocrText);
    else if (this.isGoAsia(ocrText))    parsed = this.parseGoAsia(receipt, ocrText);
    else if (this.isRewe(ocrText))      parsed = this.parseRewe(receipt, ocrText);
    else if (this.isEdeka(ocrText))     parsed = this.parseEdeka(receipt, ocrText);
    else                                parsed = this.parseGeneric(receipt, ocrText);

    parsed.comment = this.formatComment(parsed);
    return parsed;
  }

  // ── Store detection ──

  private isParadise(text: string): boolean {
    return /frische\s*paradies/i.test(text);
  }

  private isGoAsia(text: string): boolean {
    return /go\s*asia/i.test(text);
  }

  private isRewe(text: string): boolean {
    return /\bREWE\b/.test(text.split('\n').slice(0, 5).join('\n'));
  }

  private isEdeka(text: string): boolean {
    return /\bEDEKA\b/.test(text.split('\n').slice(0, 5).join('\n'));
  }

  // ══════════════════════════════════════════════════════════════
  //  1. FRISCHE PARADIES
  // ══════════════════════════════════════════════════════════════

  private parseParadise(receipt: any, ocrText: string): ParsedReceipt {
    const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l);
    const result = this.emptyResult();
    result.merchant = 'Frische Paradies';

    // Header: find address line "Zenettistraße 10e 80337 München"
    for (const line of lines.slice(0, 8)) {
      const addrMatch = line.match(/^(.+?)\s+(\d{5})\s+(.+)$/);
      if (addrMatch && /str|stra/i.test(addrMatch[1])) {
        result.street = addrMatch[1];
        result.place = addrMatch[2] + ' ' + addrMatch[3];
        break;
      }
    }

    result.date = this.extractDate(ocrText) ?? receipt.date ?? null;
    result.time = this.extractTime(ocrText) ?? receipt.time ?? null;

    // Items: starts after "Barverkauf" or "Kunde:" line, ends at "Summe"
    let inItems = false;
    let pendingItem: ReceiptItem | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      if (lower.includes('barverkauf') || lower.includes('kunde:')) { inItems = true; continue; }
      if (lower.startsWith('summe')) {
        if (pendingItem) { result.items.push(pendingItem); pendingItem = null; }
        break;
      }
      if (!inItems) continue;

      // Discount line: "MHD  20,00%  -0,80"
      if (/^mhd\b/i.test(line)) {
        const amt = this.extractSignedAmount(line);
        if (pendingItem && amt !== null) {
          pendingItem.info += pendingItem.info ? ' | ' : '';
          pendingItem.info += `Rabatt ${amt.toFixed(2)}`;
          pendingItem.price = +(pendingItem.price! + amt).toFixed(2);
        }
        continue;
      }

      // Highlight discount: "Wochenend-Highlight  1,81"
      if (/highlight/i.test(line)) {
        const amt = this.extractSignedAmount(line);
        if (pendingItem && amt !== null) {
          pendingItem.info += pendingItem.info ? ' | ' : '';
          pendingItem.info += `Wochenend-Highlight ${amt > 0 ? '-' : ''}${Math.abs(amt).toFixed(2)}`;
          pendingItem.price = +(pendingItem.price! - Math.abs(amt)).toFixed(2);
        }
        continue;
      }

      // Weight line: "0.5 kg X 28,90 EUR/kg   14.45"
      const weightMatch = line.match(/([\d.,]+)\s*kg\s*[Xx]\s*([\d.,]+)\s*EUR\s*\/\s*kg\s+([\d.,]+)/);
      if (weightMatch) {
        if (pendingItem) {
          pendingItem.price = this.parseNum(weightMatch[3]);
          pendingItem.info = `${weightMatch[1]} kg × ${weightMatch[2]} EUR/kg`;
        }
        continue;
      }

      // Skip "Gewicht manuell eingegeben"
      if (/gewicht/i.test(line)) continue;

      // Item line: "988587 LINGUINE 3MM FR GDS.1KG  1,0 ST  6,99"
      const itemMatch = line.match(/^\s*\d+\s+(.+?)(?:\s+([\d.,]+)\s*(?:ST|kg))\s*([\d.,]+)?$/i);
      if (itemMatch) {
        if (pendingItem) result.items.push(pendingItem);
        const name = this.cleanItemName(itemMatch[1]);
        const qty = itemMatch[2];
        const unit = /kg/i.test(line) ? 'kg' : 'ST';
        const price = itemMatch[3] ? this.parseNum(itemMatch[3]) : null;
        pendingItem = {
          name,
          price,
          info: unit === 'kg' ? '' : (qty !== '1,0' ? `${qty} ${unit}` : '')
        };
        continue;
      }

      // Simpler item line (single price at end): "513114 ERDBEERE KL. 500G POLEN 1,0 ST 7,80"
      const simpleMatch = line.match(/^\s*\d+\s+(.+?)\s+([\d.,]+)$/);
      if (simpleMatch && !/EUR|kg/i.test(line)) {
        if (pendingItem) result.items.push(pendingItem);
        pendingItem = {
          name: this.cleanItemName(simpleMatch[1]),
          price: this.parseNum(simpleMatch[2]),
          info: ''
        };
        continue;
      }
    }
    if (pendingItem) result.items.push(pendingItem);

    result.total = this.findAmountOnLine(ocrText, /^.*summe/i) ?? receipt.total ?? null;
    return result;
  }

  // ══════════════════════════════════════════════════════════════
  //  2. GO ASIA
  // ══════════════════════════════════════════════════════════════

  private parseGoAsia(receipt: any, ocrText: string): ParsedReceipt {
    const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l);
    const result = this.emptyResult();
    result.merchant = 'go asia Supermarkt';

    // Address: "Stachus-Passagen, 80335 München"
    for (const line of lines.slice(0, 6)) {
      const addrMatch = line.match(/^(.+?),?\s+(\d{5})\s+(.+)$/);
      if (addrMatch && !(/go\s*asia/i.test(line))) {
        result.street = addrMatch[1].replace(/,\s*$/, '');
        result.place = addrMatch[2] + ' ' + addrMatch[3];
        break;
      }
    }

    result.date = this.extractDate(ocrText) ?? receipt.date ?? null;
    result.time = this.extractTime(ocrText) ?? receipt.time ?? null;

    // Items: after "EUR" header line, before "Summe vor Rabatt"
    let inItems = false;
    let pendingItem: ReceiptItem | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      if (/^\s*EUR\s*$/i.test(line) || /nr\.?\s+artikel/i.test(line)) { inItems = true; continue; }
      if (lower.includes('summe')) {
        if (pendingItem) { result.items.push(pendingItem); pendingItem = null; }
        break;
      }
      if (!inItems) continue;

      // Item line: "80193 TK Sui Kau mit Garnelen 18*15g    5,99 A"
      const itemMatch = line.match(/^\s*\d+\s+(.+?)\s+([\d.,]+)\s+[A-Z]\s*$/);
      if (itemMatch) {
        if (pendingItem) result.items.push(pendingItem);
        pendingItem = {
          name: itemMatch[1].trim(),
          price: this.parseNum(itemMatch[2]),
          info: ''
        };
        continue;
      }

      // Extra info line (CJK characters, continuation): belongs to previous item
      if (pendingItem && line.length > 1) {
        pendingItem.info += pendingItem.info ? ' | ' : '';
        pendingItem.info += line;
      }
    }
    if (pendingItem) result.items.push(pendingItem);

    // Total: post-discount "SUMME  EUR" followed by amount on next line
    const totalLines = ocrText.split('\n');
    let total: number | null = null;
    for (let i = 0; i < totalLines.length; i++) {
      const line = totalLines[i];
      if (/summe/i.test(line) && /eur/i.test(line) && !/vor\s+rabatt/i.test(line)) {
        total = this.extractAmount(line);
        if (total === null && i + 1 < totalLines.length) {
          total = this.extractAmount(totalLines[i + 1]);
        }
        break;
      }
    }
    result.total = total ?? receipt.total ?? null;
    return result;
  }

  // ══════════════════════════════════════════════════════════════
  //  3. REWE
  // ══════════════════════════════════════════════════════════════

  private parseRewe(receipt: any, ocrText: string): ParsedReceipt {
    const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l);
    const result = this.emptyResult();
    result.merchant = 'REWE';

    for (let i = 0; i < Math.min(8, lines.length); i++) {
      const line = lines[i];
      if (/str\.|straße|strasse/i.test(line) && !result.street) {
        result.street = line;
      }
      const plzMatch = line.match(/^(\d{5})\s+(.+)$/);
      if (plzMatch && !result.place) {
        result.place = plzMatch[0];
      }
    }

    result.date = this.extractDate(ocrText) ?? receipt.date ?? null;
    result.time = this.extractTime(ocrText) ?? receipt.time ?? null;

    let inItems = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      if (/^\s*EUR\s*$/.test(line)) { inItems = true; continue; }
      if (lower.includes('summe') || lower.includes('posten:')) {
        break;
      }
      if (!inItems) continue;

      const itemMatch = line.match(/^(.+?)\s{2,}([\d.,]+)\s+[A-Z]\s*$/);
      if (itemMatch) {
        const name = itemMatch[1].trim();
        const price = this.parseNum(itemMatch[2]);

        let info = '';
        if (i + 1 < lines.length) {
          const next = lines[i + 1].trim();
          const weightInfo = next.match(/^([\d.,]+)\s*kg\s*x\s*([\d.,]+)\s*EUR\/kg$/i);
          const qtyInfo = next.match(/^(\d+)\s*Stk\s*x\s*([\d.,]+)$/i);
          if (weightInfo) {
            info = `${weightInfo[1]} kg × ${weightInfo[2]} EUR/kg`;
            i++;
          } else if (qtyInfo) {
            info = `${qtyInfo[1]} × ${qtyInfo[2]}`;
            i++;
          }
        }

        result.items.push({ name, price, info });
        continue;
      }
    }

    result.total = this.findAmountOnLine(ocrText, /^.*summe/i) ?? receipt.total ?? null;
    return result;
  }

  // ══════════════════════════════════════════════════════════════
  //  4. EDEKA
  // ══════════════════════════════════════════════════════════════

  private parseEdeka(receipt: any, ocrText: string): ParsedReceipt {
    const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l);
    const result = this.emptyResult();
    result.merchant = 'EDEKA';

    let foundEdeka = false;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      if (/^E(DEKA)?$/i.test(line)) { foundEdeka = true; continue; }
      if (!foundEdeka) continue;
      if (/str\.|straße|strasse/i.test(line) && !result.street) {
        result.street = line;
        continue;
      }
      const plzMatch = line.match(/^(\d{5})\s+(.+)$/);
      if (plzMatch && !result.place) {
        result.place = plzMatch[0];
        continue;
      }
      if (/tel\.|www\./i.test(line)) break;
    }

    result.date = this.extractDate(ocrText) ?? receipt.date ?? null;
    result.time = this.extractTime(ocrText) ?? receipt.time ?? null;

    let inItems = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      if (/^\s*EUR\s*$/.test(line)) { inItems = true; continue; }
      if (lower.includes('posten:') || lower.startsWith('summe')) {
        break;
      }
      if (!inItems) continue;

      // Multi-buy: "Herz.Van.scho 2,99 € x 2 5,98 A"
      const multiMatch = line.match(/^(.+?)\s+([\d.,]+)\s*€\s*x\s*(\d+)\s+([\d.,]+)\s+[A-Z]\s*$/);
      if (multiMatch) {
        result.items.push({
          name: multiMatch[1].trim(),
          price: this.parseNum(multiMatch[4]),
          info: `${multiMatch[3]} × ${multiMatch[2]}€`
        });
        continue;
      }

      const itemMatch = line.match(/^(.+?)\s{2,}([\d.,]+)\s+[A-Z]\s*$/);
      if (itemMatch) {
        const name = itemMatch[1].trim();
        const price = this.parseNum(itemMatch[2]);

        let info = '';
        if (i + 1 < lines.length) {
          const next = lines[i + 1].trim();
          const weightInfo = next.match(/^([\d.,]+)\s*kg\s*x\s*([\d.,]+)\s*€\/kg$/i);
          if (weightInfo) {
            info = `${weightInfo[1]} kg × ${weightInfo[2]} €/kg`;
            i++;
          }
        }
        result.items.push({ name, price, info });
        continue;
      }
    }

    result.total = this.findAmountOnLine(ocrText, /^.*summe/i) ?? receipt.total ?? null;
    return result;
  }

  // ══════════════════════════════════════════════════════════════
  //  5. GENERIC READER
  // ══════════════════════════════════════════════════════════════

  private parseGeneric(receipt: any, ocrText: string): ParsedReceipt {
    const result = this.emptyResult();

    if (!ocrText) {
      result.merchant = receipt.merchant_name || '';
      if (receipt.merchant_address) {
        const addrParts = receipt.merchant_address.match(/^(.+?),?\s+(\d{5})\s+(.+)$/);
        if (addrParts) {
          result.street = addrParts[1];
          result.place = addrParts[2] + ' ' + addrParts[3];
        } else {
          result.street = receipt.merchant_address;
        }
      }
      result.total = receipt.total ?? null;
      result.date = receipt.date ?? null;
      result.time = receipt.time ?? null;
      if (receipt.items?.length) {
        for (const item of receipt.items) {
          if (!item.description) continue;
          const desc = item.description.toLowerCase();
          if (desc.includes('summe') || desc.includes('mastercard') || desc.includes('visa')) continue;
          result.items.push({ name: item.description, price: item.amount ?? null, info: '' });
        }
      }
      return result;
    }

    const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l);

    // ── Merchant & Address ──
    let merchantFound = false;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      if (/^(EUR|USD|GBP)$/i.test(line)) continue;
      if (lower.includes('uid') || lower.includes('ust-id') || lower.includes('steuer')) continue;
      if (/^\d{10,}$/.test(line)) continue;
      if (/^-+$/.test(line)) continue;
      if (lower.includes('tel') || lower.includes('www.') || lower.includes('fax')) continue;

      if (/str\.|straße|strasse|weg\s|allee|platz\s/i.test(line) && !result.street) {
        const combined = line.match(/^(.+?(?:str\.|straße|strasse|weg|allee|platz)\s*\S*),?\s+(\d{5})\s+(.+)$/i);
        if (combined) {
          result.street = combined[1].replace(/,\s*$/, '');
          result.place = combined[2] + ' ' + combined[3];
        } else {
          result.street = line;
        }
        continue;
      }

      const plzMatch = line.match(/^(\d{5})\s+(.+)$/);
      if (plzMatch && !result.place) {
        result.place = plzMatch[0];
        continue;
      }

      if (!merchantFound && !line.match(/\d+[,.](\d{2})/) && line.length > 1 && line.length < 50) {
        result.merchant = line;
        merchantFound = true;
        continue;
      }

      if (line.match(/\d+[,.]\d{2}\s+[A-Z]\s*$/)) break;
    }

    if (!result.merchant && receipt.merchant_name) {
      result.merchant = receipt.merchant_name;
    }

    result.date = this.extractDate(ocrText) ?? receipt.date ?? null;
    result.time = this.extractTime(ocrText) ?? receipt.time ?? null;

    // ── Items ──
    let inItems = false;
    const stopWords = /summe|zu\s*zahlen|gesamt|total|posten:|mwst|kundenbeleg|kartenzahlung|bezahlung|geg\.\s*(master|visa)/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inItems) {
        if (/\d+[,.]\d{2}\s+[A-Z]\s*$/.test(line) || /\d+[,.]\d{2}\s*€\s*[A-Z]?\s*$/.test(line)) {
          inItems = true;
        } else {
          continue;
        }
      }

      if (stopWords.test(line)) break;

      const itemMatch = line.match(/^(.+?)\s{2,}([\d.,]+)\s+[A-Z]\s*$/)
                      || line.match(/^(.+?)\s{2,}([\d.,]+)\s*€\s*[A-Z]?\s*$/);
      if (itemMatch) {
        const name = itemMatch[1].trim();
        const price = this.parseNum(itemMatch[2]);

        let info = '';
        if (i + 1 < lines.length) {
          const next = lines[i + 1].trim();
          const weightInfo = next.match(/^([\d.,]+)\s*kg\s*x\s*([\d.,]+)/i);
          const qtyInfo = next.match(/^(\d+)\s*(?:Stk|ST)\s*x\s*([\d.,]+)/i);
          if (weightInfo) { info = `${weightInfo[1]} kg × ${weightInfo[2]}`; i++; }
          else if (qtyInfo) { info = `${qtyInfo[1]} × ${qtyInfo[2]}`; i++; }
        }
        result.items.push({ name, price, info });
        continue;
      }

      const trailingPrice = line.match(/^(.+?)\s+([\d.,]+)\s+[A-Z]\s*$/);
      if (trailingPrice && trailingPrice[1].match(/[a-zA-Z]{2,}/)) {
        result.items.push({
          name: trailingPrice[1].trim(),
          price: this.parseNum(trailingPrice[2]),
          info: ''
        });
      }
    }

    // ── Total ──
    const keywords = [/zu\s*zahlen/i, /gesamt/i, /total/i, /summe/i];
    let total: number | null = null;
    const rawLines = ocrText.split('\n');
    for (const keyword of keywords) {
      for (let i = 0; i < rawLines.length; i++) {
        if (keyword.test(rawLines[i]) && !/vor\s+rabatt/i.test(rawLines[i])) {
          total = this.extractAmount(rawLines[i]);
          if (total === null && i + 1 < rawLines.length) {
            total = this.extractAmount(rawLines[i + 1]);
          }
          if (total !== null) break;
        }
      }
      if (total !== null) break;
    }
    result.total = total ?? receipt.total ?? null;

    return result;
  }

  // ── Comment formatting ──

  formatComment(parsed: ParsedReceipt): string {
    const parts: string[] = [];

    if (parsed.merchant) parts.push(parsed.merchant);
    if (parsed.street)   parts.push(parsed.street);
    if (parsed.place)    parts.push(parsed.place);
    if (parts.length > 0) parts.push('---');

    for (const item of parsed.items) {
      let line = item.name;
      if (item.price !== null) line += '  ' + this.fmtPrice(item.price);
      parts.push(line);
      if (item.info) parts.push('  ' + item.info);
    }

    return parts.join('\n');
  }

  // ── Shared helpers ──

  private emptyResult(): ParsedReceipt {
    return { merchant: '', street: '', place: '', total: null, date: null, time: null, items: [], comment: '' };
  }

  findAmountOnLine(ocrText: string, keyword: RegExp): number | null {
    for (const line of ocrText.split('\n')) {
      if (keyword.test(line) && !/vor\s+rabatt/i.test(line)) {
        return this.extractAmount(line);
      }
    }
    return null;
  }

  extractAmount(line: string): number | null {
    const matches = [...line.matchAll(/(\d+)[,.](\d{2})(?!\d)/g)];
    if (!matches.length) return null;
    return parseFloat(matches[matches.length - 1][1] + '.' + matches[matches.length - 1][2]);
  }

  private extractSignedAmount(line: string): number | null {
    // Find the last monetary amount on the line (skips percentages etc.)
    const matches = [...line.matchAll(/(-?\d+)[,.](\d{2})(?!\d)/g)];
    if (!matches.length) return null;
    const last = matches[matches.length - 1];
    return parseFloat(last[1] + '.' + last[2]);
  }

  extractDate(ocrText: string): string | null {
    for (const line of ocrText.split('\n')) {
      const deMatch = line.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (deMatch) {
        const [, day, month, year] = deMatch;
        const y = +year, m = +month, d = +day;
        if (y >= 2020 && y <= 2040 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return `${year}-${month}-${day}`;
        }
      }
      const isoMatch = line.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        const y = +year, m = +month, d = +day;
        if (y >= 2020 && y <= 2040 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return `${year}-${month}-${day}`;
        }
      }
    }
    return null;
  }

  extractTime(ocrText: string): string | null {
    for (const line of ocrText.split('\n')) {
      const lower = line.toLowerCase();
      if (lower.includes('uhrzeit:') || lower.includes('zeit:') || lower.includes('time:')) {
        if (/\b(mo|di|mi|do|fr|sa|so)\b/i.test(line)) continue;
        const match = line.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (match) {
          const h = +match[1], m = +match[2];
          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          }
        }
      }
    }
    return null;
  }

  private parseNum(s: string): number {
    return parseFloat(s.replace(',', '.'));
  }

  private fmtPrice(n: number): string {
    return n.toFixed(2).replace('.', ',');
  }

  private cleanItemName(name: string): string {
    return name.replace(/\s+[\d.,]+\s*(?:ST|kg)?\s*$/i, '').trim();
  }
}
