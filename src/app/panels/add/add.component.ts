import { Component, ɵNOT_FOUND_CHECK_ONLY_ELEMENT_INJECTOR } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { Transaction } from '../../interfaces/transaction';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { Revenue } from '../../interfaces/revenue';
import { Expense } from 'src/app/interfaces/expense';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Interest } from 'src/app/interfaces/interest';
import { Property } from 'src/app/interfaces/property';
import { Liability } from 'src/app/interfaces/liability';
import { Share } from 'src/app/interfaces/share';
import { Investment } from 'src/app/interfaces/investment';
import { FrontendLoggerService } from 'src/app/shared/services/frontend-logger.service';
import { environment } from 'src/environments/environment';
import { forkJoin, of } from 'rxjs';
import { AuthService } from 'src/app/shared/services/auth.service';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsComponent } from '../settings/settings.component';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { migrateSmileArray } from 'src/app/shared/smile-migration.utils';
import { migrateFireArray } from 'src/app/shared/fire-migration.utils';


// Deferred imports — resolved after module init to break circular chains
let ProfileComponent: any; setTimeout(() => import('../profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('../menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let InfoComponent: any; setTimeout(() => import('../info/info.component').then(m => InfoComponent = m.InfoComponent));
let SmileProjectsComponent: any; setTimeout(() => import('src/app/main/smile/smile-projects/smile-projects.component').then(m => SmileProjectsComponent = m.SmileProjectsComponent));
let FireEmergenciesComponent: any; setTimeout(() => import('src/app/main/fire/fire-emergencies/fire-emergencies.component').then(m => FireEmergenciesComponent = m.FireEmergenciesComponent));
let FireComponent: any; setTimeout(() => import('src/app/main/fire/fire.component').then(m => FireComponent = m.FireComponent));
let IncomeComponent: any; setTimeout(() => import('src/app/main/cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let AccountingComponent: any; setTimeout(() => import('src/app/main/accounting/accounting.component').then(m => AccountingComponent = m.AccountingComponent));
let BalanceComponent: any; setTimeout(() => import('src/app/main/cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let GrowComponent: any; setTimeout(() => import('src/app/main/grow/grow.component').then(m => GrowComponent = m.GrowComponent));
let DailyComponent: any; setTimeout(() => import('src/app/main/daily/daily.component').then(m => DailyComponent = m.DailyComponent));
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
@Component({
  selector: 'app-add',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add.component.html',
  styleUrls: ['../../shared/styles/add-form.css', './add.component.css']
})
export class AddComponent extends BaseAddComponent {
  static selectedOption = "Daily";
  static amountTextField = "";
  d = new Date();
  dateTextField = this.d.getFullYear() + "-" + this.zeroPadded(this.d.getMonth() + 1) + "-" + this.zeroPadded(this.d.getDate());
  timeTextField = this.d.getHours() + ":" + this.d.getMinutes();
  static categoryTextField = "@";
  static commentTextField = "";
  static isLiabilitie = false;
  static loanTextField = "";
  static creditTextField = "";
  static isShare = false;
  static shareTextField = "50";
  static isTaxExpense = false;
  
  showCategoryOptions = false;
  showCreditOptions = false;
  showLoanOptions = false;
  showShareOptions = true;

  static url = "/transactions";
  static zIndex;
  static isAdd;
  static isError;
  public classReference = AddComponent;
  public settingsReference = SettingsComponent;

  image = 'https://tesseract.projectnaptha.com/img/eng_bw.png';
  toggleScan = false;
  private mode: 'firebase' | 'selfhosted' = environment.mode as 'firebase' | 'selfhosted';

  /**
   * Constructs a new instance of the AddComponent class.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   * @param afAuth - The AngularFireAuth service.
   * @param authService - The centralized authentication service.
   * @param frontendLogger - The frontend logging service.
   */
  constructor(
    router: Router, 
    private localStorage: LocalService, 
    private database: DatabaseService, 
    public afAuth: AngularFireAuth,
    private authService: AuthService,
    private frontendLogger: FrontendLoggerService
  ) {
    super(router);
    AddComponent.isAdd = false;
    this.initStatic(AddComponent);
  }

  
  static categoryOptions = [
    { value: '@Food', label: 'Food' },
    { value: '@Transport', label: 'Transport' },
    { value: '@Entertainment', label: 'Entertainment' },
    // Add more options as needed
  ];

  
  ngOnInit() {
    AddComponent.populateCategoryOptions();
  }

  ngAfterViewInit() {
    // Add any additional logic you want to execute when the component is visible
  }

  toggleButtons() {
    this.errorLable = "";
    this.isLoading = false;
    this.isError = false;
    this.toggleScan = !this.toggleScan;
  }

  receiptOcrEndpoint = 'https://ocr.asprise.com/api/v1/receipt';
  isLoading = false;
  isError = false;
  errorLable = "";

  /**
   * Sends the captured camera image to the Asprise OCR API for receipt recognition.
   *
   * Parses the JSON response to extract the receipt total and date, cross-validates
   * the total against raw OCR text (looking for "Summe"/"Total" lines), and
   * auto-fills the amount (negated) and date fields in the add-transaction form.
   */
  async recognizeImage() {
    if (!this.image) {
      console.error("No image data available");
      return;
    }
    this.isLoading = true;

    try {
      const formData = new FormData();
      formData.append('api_key', 'TEST');
      formData.append('recognizer', 'auto');
      formData.append('ref_no', 'ocr_nodejs_123');
      formData.append('file', this.dataURLtoBlob(this.image));

      const response = await fetch(this.receiptOcrEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        this.isLoading = false;
        this.isError = true;
        this.errorLable = `HTTP error! status: ${response.status}`;
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const body = await response.json();
      this.isLoading = false;
      
      // Validate receipt data exists
      if (!body.receipts || body.receipts.length === 0) {
        this.isError = true;
        this.errorLable = "No receipt data found";
        return;
      }
      
      const receipt = body.receipts[0];
      
      // Validate total from OCR text
      let validatedTotal = receipt.total;
      if (receipt.ocr_text && receipt.total !== null && receipt.total !== undefined) {
        const lines = receipt.ocr_text.split('\n');
        let ocrTotal: number | null = null;
        
        for (const line of lines) {
          const lowerLine = line.toLowerCase();
          // Look for total/summe lines
          if (lowerLine.includes('summe') || lowerLine.includes('zu zahlen') || 
              lowerLine.includes('total') || lowerLine.includes('gesamt')) {
            // Extract number from line (format: "SUMME EUR 23,52" or "23,52 EUR")
            const match = line.match(/(\d+[,\.]\d{2})\s*(EUR|USD|GBP)?/i);
            if (match) {
              const amount = parseFloat(match[1].replace(',', '.'));
              if (!isNaN(amount) && amount > 0) {
                ocrTotal = amount;
                break;
              }
            }
          }
        }
        
        // Compare OCR total with API total
        if (ocrTotal !== null) {
          const tolerance = 0.01; // Allow 1 cent difference due to rounding
          if (Math.abs(ocrTotal - receipt.total) > tolerance) {
            console.warn(`Total mismatch: API=${receipt.total}, OCR=${ocrTotal}. Using OCR value.`);
            validatedTotal = ocrTotal;
          }
        }
      }
      
      // Set the total field *-1 if not null
      if (validatedTotal !== null && validatedTotal !== undefined) {
        AddComponent.amountTextField = "-" + validatedTotal;
      }

      // Set the date if not null
      if (receipt.date !== null && receipt.date !== undefined) {
        this.dateTextField = receipt.date;
      }

      // Set the time if not null and valid, otherwise search in OCR text
      if (receipt.time !== null && receipt.time !== undefined && receipt.time !== '') {
        this.timeTextField = receipt.time;
      } else if (receipt.ocr_text) {
        // Fallback: Search for time in OCR text
        const timeMatch = this.extractTimeFromOCR(receipt.ocr_text);
        if (timeMatch) {
          this.timeTextField = timeMatch;
        }
      }

      // Parse the OCR text directly for better formatting
      let comment = '';
      
      if (receipt.ocr_text) {
        const lines = receipt.ocr_text.split('\n').map(l => l.trim());
        let inItemSection = false;
        let merchantLines: string[] = [];
        let itemLines: string[] = [];
        
        // Smart merchant detection from OCR
        let merchantName = '';
        for (let i = 0; i < Math.min(10, lines.length); i++) {
          const line = lines[i];
          if (!line || line.length < 2) continue;
          
          const lowerLine = line.toLowerCase();
          
          // Skip currency markers and section headers
          if (line.match(/^\s*(EUR|USD|GBP|Preis|Menge|Artikel)\s*$/i)) continue;
          
          // Skip tax IDs and legal info
          if (lowerLine.includes('uid') || lowerLine.includes('ust-id') || 
              lowerLine.includes('tax') || lowerLine.includes('mwst') ||
              lowerLine.includes('kundenbeleg')) continue;
          
          // Skip separator lines
          if (line.match(/^\s*-+\s*$/)) continue;
          
          // Skip long numeric IDs (product/article IDs like "4007123560059")
          if (line.match(/^\d{10,}$/)) continue;
          
          // Skip lines that are clearly addresses or have street patterns
          if (lowerLine.match(/str\.|straße|strasse|platz|weg|allee/i) || 
              line.match(/^\d{5}/)) {
            // This is an address, add to merchant info but don't use as merchant name
            // Limit to 2 address lines (street + city) after merchant name
            if (merchantLines.length < 2) {
              merchantLines.push(line);
            }
            continue;
          }
          
          // If line doesn't have numbers (prices) and is reasonably short, might be merchant name
          if (!merchantName && !line.match(/\d+[,\.]\d+/) && line.length < 40 && line.length > 2) {
            merchantName = line;
            continue;
          }
          
          // Once we find a line with a price, stop looking for merchant
          if (line.match(/\d+[,\.]\d+\s*€?\s*[A-Z]?/)) {
            break;
          }
        }
        
        // Fallback to API merchant_name if we didn't find one in OCR
        if (!merchantName && receipt.merchant_name) {
          merchantName = receipt.merchant_name;
        }
        
        // Build merchant header
        if (merchantName) {
          merchantLines.unshift(merchantName);
        }
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          
          const lowerLine = line.toLowerCase();
          
          // Skip column headers
          if (lowerLine.match(/^\s*(menge|artikel|preis|artikelname)\s*$/i) || 
              lowerLine.match(/artikelname\s+\/€/i)) continue;
          
          // Detect start of item section (after header, when we see prices)
          if (!inItemSection) {
            // More robust price detection - matches lines ending with prices
            // Patterns: "4,50 € B", "9.99 A", "27,13 A", "4,50 €/stk. #111883 4,50 € B"
            // Also detect lines with EAN codes followed by product names
            // Also detect "Product name    1st x 2,50 (A)" format
            const hasPriceAtEnd = line.match(/\d+[,\.]\d{2}\s+[A-Z]\s*$/i) || // "9.99 A"
                                  line.match(/\d+[,\.]\d{2}\s*€\s*[A-Z]?\s*$/i) || // "4,50 € B" or "4,50 €"
                                  line.match(/\d+[,\.]\d{2}\s*\([A-Z]\)\s*$/i); // "2,50 (A)"
            
            // Detect EAN code pattern (long number followed by text)
            const hasEanPattern = line.match(/^\s*\d{8,13}\s+[a-zA-Z]/);
            
            // Detect product with price pattern (e.g., "Apfelkrapfen    1st x 2,50 (A)")
            const hasProductPricePattern = line.match(/^[a-zA-Z][a-zA-Z\s]{2,}?\s+\d+\s*st\s*x\s*\d+[,\.]\d{2}/i);
            
            if (hasPriceAtEnd || hasEanPattern || hasProductPricePattern) {
              inItemSection = true;
              
              // Check PREVIOUS line for product name (first item case)
              if (i > 0) {
                const prevLine = lines[i - 1].trim();
                const prevLineLower = prevLine.toLowerCase();
                
                // Add previous line if it's a product name
                if (prevLine && 
                    !prevLine.match(/\d+[,\.]\d{2}\s*€?\s*[A-Z]?\*?\s*$/) && // No price at end
                    !prevLineLower.includes('summe') && 
                    !prevLineLower.includes('menge') && 
                    !prevLineLower.includes('artikel') &&
                    !prevLineLower.includes('preis') &&
                    !prevLineLower.match(/^\s*-+\s*$/) && // Not separator
                    prevLine.length > 2 &&
                    prevLine.match(/[a-zA-Z]{3,}/)) { // Has at least 3 letters
                  itemLines.push('  ' + prevLine); // Indent product name
                }
              }
              // Don't continue - process this line
            } else {
              // Skip header lines before items start
              continue;
            }
          }
          
          // Stop at totals/payment section
          if (lowerLine.includes('summe') || 
              lowerLine.includes('zu zahlen') ||
              lowerLine.includes('gesamtmenge') ||
              lowerLine.match(/typ\s*\/\/\s*type/i) ||
              lowerLine.match(/netto\/€.*mwst/i) ||
              lowerLine.match(/geg\.?\s*(mastercard|visa|kreditkarte|ec)/i) ||
              lowerLine.includes('posten:') ||
              lowerLine.includes('mwst') ||
              lowerLine.includes('betrag eur') ||
              lowerLine.includes('kundenbeleg') ||
              lowerLine.includes('datum:') ||
              lowerLine.includes('uhrzeit:') ||
              lowerLine.includes('beleg-nr') ||
              lowerLine.includes('belegnummer') ||
              lowerLine.includes('trace-nr') ||
              lowerLine.includes('terminal') ||
              lowerLine.includes('bezahlung') ||
              lowerLine.includes('kartenzahlung') ||
              lowerLine.includes('approved') ||
              lowerLine.includes('bedienung:') ||
              lowerLine.includes('filiale')) {
            break;
          }
          
          if (inItemSection) {
            // Skip deposit/return lines (LEERGUT, Pfand with negative amounts)
            if ((lowerLine.includes('leergut') || lowerLine.includes('pfand')) && line.includes('-')) {
              continue;
            }
            
            // Skip lines with only quantity info (e.g., "12 Stk x 0,08")
            if (line.match(/^\d+\s*Stk\s*x\s*\d/i)) {
              continue;
            }
            
            // Skip standalone negative amounts or tax markers
            if (line.match(/^\s*-?\d+[,\.]\d+\s*[A-Z]?\*?\s*$/) && !line.match(/[a-zA-Z]{3,}/)) {
              continue;
            }
            
            // Skip lines that are just tax codes or flags
            if (line.match(/^\s*[A-Z]{1,3}\s*$/) || line.match(/^RBW$/)) {
              continue;
            }
            
            // Skip very short lines without prices (likely fragments)
            if (line.length < 5 && !line.match(/\d/)) {
              continue;
            }
            
            // Pattern 1: EAN code with product name on same line (e.g., "4042448502452 tesa Malerband")
            const eanWithProductMatch = line.match(/^\s*(\d{8,13})\s+(.+)/);
            if (eanWithProductMatch) {
              const productName = eanWithProductMatch[2].trim();
              // Only add if it looks like a product name (has letters, not just numbers/prices)
              if (productName && productName.match(/[a-zA-Z]{3,}/) && !productName.match(/^\d+[,\.]\d{2}/)) {
                itemLines.push(productName);
                continue; // Move to next line
              }
            }
            
            // Pattern 2: Product name with quantity and price on same line
            // Examples: "Apfelkrapfen                1st x 2,50 (A)" or "Kaffee 2x 3,50 (B)"
            const productWithPriceMatch = line.match(/^([a-zA-Z][a-zA-Z\s]{2,}?)\s+(\d+\s*st\s*x\s*\d+[,\.]\d{2})\s*\(([A-Z])\)/i);
            if (productWithPriceMatch) {
              const productName = productWithPriceMatch[1].trim();
              const qtyPrice = productWithPriceMatch[2].trim().toLowerCase();
              
              // Keep on same line as original: "Product Name  1 st x 2,50"
              itemLines.push(`${productName}  ${qtyPrice}`);
              continue;
            }
            
            // Pattern 3: Quantity x unit price followed by total price in parentheses
            // Examples: "5 st x 0,95                      4,75 (A)"
            const qtyPriceTotalMatch = line.match(/^\s*(\d+\s+st\s+x\s+\d+[,\.]\d{2})\s+(\d+[,\.]\d{2})\s*\(([A-Z])\)/i);
            if (qtyPriceTotalMatch) {
              const qtyPrice = qtyPriceTotalMatch[1].trim();
              const total = qtyPriceTotalMatch[2];
              
              // Check if previous line is a product name
              if (i > 0) {
                const prevLine = lines[i - 1].trim();
                const prevLineLower = prevLine.toLowerCase();
                
                // If previous line looks like a product name, add it
                if (prevLine && prevLine.match(/^[a-zA-Z][a-zA-Z\s]{2,}$/) && 
                    !prevLineLower.includes('artikelname') &&
                    !itemLines.some(il => il.trim() === prevLine)) {
                  itemLines.push(prevLine);
                }
              }
              
              // Add the quantity/price info and total
              itemLines.push(`    ${qtyPriceTotalMatch[1].toLowerCase()} = ${total}`);
              continue;
            }
            
            // Pattern 4: Price line (quantity/unit + price + tax code)
            // Examples: "     1 ST                 B            9,99" or "1 ST B 9,99"
            const priceLineMatch = line.match(/^\s*(\d+\s+ST)\s+([A-Z])\s+(\d+[,\.]\d{2})\s*$/i);
            if (priceLineMatch) {
              const quantity = priceLineMatch[1].trim();
              const taxCode = priceLineMatch[2];
              const price = priceLineMatch[3];
              
              // Format: "1x 9,99" or just "9,99"
              itemLines.push(`    ${quantity.toLowerCase()}  ${price}`);
              continue;
            }
            
            // Pattern 3: Check if this line has a price (item line)
            // Must end with: "9.99 A", "4,50 € B", "27,13 A" (price + optional € + tax code)
            const isPriceLine = line.match(/\d+[,\.]\d{2}\s*€?\s*[A-Z]\s*$/i) || // Must have tax code
                               line.match(/\d+[,\.]\d{2}\s*€\s*$/); // Or just € without tax code
            
            if (isPriceLine) {
              // Check if the line has a product name at the start (REWE format: "INGWER BIO    0,55 B")
              const productPriceOnSameLine = line.match(/^([A-Z][A-Z\s\.\/\-]{2,}?)\s{2,}(\d+[,\.]\d{2}\s*€?\s*[A-Z]?\*?\s*)$/i);
              
              if (productPriceOnSameLine) {
                // Product name and price on same line (REWE format)
                // Keep the original line format
                itemLines.push(line);
                continue;
              }
              
              // Check PREVIOUS line for product name (name above price format)
              if (i > 0) {
                const prevLine = lines[i - 1].trim();
                const prevLineLower = prevLine.toLowerCase();
                
                // Check if previous line is a product name (not already added)
                // Also check if it's an EAN + product line that we haven't processed yet
                const prevEanMatch = prevLine.match(/^\s*\d{8,13}\s+(.+)/);
                if (prevEanMatch) {
                  const productName = prevEanMatch[1].trim();
                  if (productName && productName.match(/[a-zA-Z]{3,}/) && 
                      !itemLines.some(il => il.trim() === productName)) {
                    itemLines.push(productName);
                  }
                } else if (prevLine && 
                    !prevLine.match(/\d+[,\.]\d{2}\s*€?\s*[A-Z]?\*?\s*$/i) && // No price at end
                    !prevLine.match(/^\d{8,13}/) && // Not an EAN code line
                    !prevLineLower.includes('summe') && 
                    !prevLineLower.includes('menge') && 
                    !prevLineLower.includes('artikel') &&
                    !prevLineLower.includes('preis') &&
                    prevLine.length > 2 &&
                    prevLine.match(/[a-zA-Z]{3,}/) && // Has at least 3 letters
                    !itemLines.some(il => il.trim() === prevLine)) { // Not already added
                  itemLines.push('  ' + prevLine); // Indent product name
                }
              }
              
              // Extract just the price and quantity info from the line
              const priceExtract = line.match(/(\d+\s+ST)?\s*([A-Z])?\s*(\d+[,\.]\d{2})\s*€?\s*([A-Z])?\s*$/i);
              if (priceExtract) {
                const qty = priceExtract[1] ? priceExtract[1].toLowerCase() + ' ' : '';
                const price = priceExtract[3];
                itemLines.push(`    ${qty}${price}`);
              } else {
                // Fallback: Add the whole line
                itemLines.push(line);
              }
              
              // Check NEXT line for product name (name below price format)
              if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                const nextLineLower = nextLine.toLowerCase();
                
                // Check if next line is EAN + product
                const nextEanMatch = nextLine.match(/^\s*\d{8,13}\s+(.+)/);
                if (nextEanMatch) {
                  // This is the next item, don't add it here
                  continue;
                }
                
                // Add next line if it's a product name (no price, not empty, not a section marker)
                if (nextLine && 
                    !nextLine.match(/\d+[,\.]\d{2}\s*€?\s*[A-Z]?\s*$/i) && // No price at end
                    !nextLine.match(/^\d{8,13}/) && // Not an EAN line
                    !nextLineLower.includes('summe') && 
                    !nextLineLower.includes('zu zahlen') &&
                    !nextLineLower.includes('kundenbeleg') &&
                    !nextLineLower.includes('datum:') &&
                    !nextLineLower.includes('uhrzeit:') &&
                    !nextLineLower.includes('beleg-nr') &&
                    !nextLineLower.includes('posten:') &&
                    nextLine.length > 2 &&
                    nextLine.match(/[a-zA-Z]{3,}/)) { // Has at least 3 letters (product name)
                  itemLines.push('  ' + nextLine); // Indent product name for clarity
                  i++; // Skip next line since we already processed it
                }
              }
            }
            // Include detail lines (like weight/quantity info)
            else if (line.match(/\d+\s*Stk\s*x/i) ||
                     line.match(/\d+[,\.]\d+\s*(kg|g|l|ml|m2|m²)/i)) {
              itemLines.push('  ' + line); // Indent detail lines
            }
            // Collect lines that might be product names (will be added when price line is found)
            else if (line.match(/^\s*\d+\s+[Ss]tk\s+/i) || // Lines starting with quantity (e.g., "1 Stk Laugenecke")
                     (line.match(/[a-zA-Z]{5,}/) && !line.match(/\d{8,}/))) { // Text lines without EAN codes
              // Don't add here, will be picked up by previous/next line check above
              continue;
            }
          }
        }
        
        // Normalize price alignment - make prices right-aligned
        if (itemLines.length > 0) {
          itemLines = this.normalizePriceAlignment(itemLines);
        }
        
        // Build the comment
        if (merchantLines.length > 0) {
          comment = merchantLines.join('\n') + '\n' + '---\n';
        }
        
        if (itemLines.length > 0) {
          comment += itemLines.join('\n');
        }
      }
      
      // Fallback: if OCR text parsing didn't work, use structured items
      if (!comment || comment.trim().length < 10) {
        comment = '';
        
        // Add merchant info
        if (receipt.merchant_name) {
          comment += receipt.merchant_name;
          if (receipt.merchant_address) {
            comment += '\n' + receipt.merchant_address;
          }
          comment += '\n';
        }
        
        // Add items from structured data
        if (receipt.items && receipt.items.length > 0) {
          const purchaseItems = receipt.items.filter(item => {
            if (!item.description) return false;
            const desc = item.description.toLowerCase().trim();
            if (desc.length < 3) return false;
            if (desc.match(/^(stk|x|kg|g|l|ml)\s*x?$/i)) return false;
            if (desc.includes('kreditkarte') || desc.includes('mastercard') || 
                desc.includes('geg.') || desc.includes('summe') || desc.includes('leergut')) return false;
            if (item.amount <= 0) return false;
            return true;
          });
          
          purchaseItems.forEach(item => {
            let line = item.description;
            if (item.amount !== null && item.amount !== undefined) {
              line += ' ' + item.amount.toFixed(2);
            }
            if (item.flags && item.flags.trim()) {
              line += ' ' + item.flags.trim();
            }
            comment += line + '\n';
          });
        }
      }

      AddComponent.commentTextField = comment.trim();
      
    } catch (error) {
      console.error("Error recognizing image:", error);
      this.isLoading = false;
      this.isError = true;
      // Only set generic error if no specific error was already set
      if (!this.errorLable) {
        this.errorLable = error instanceof Error ? error.message : "Error processing receipt";
      }
    }
  }

  dataURLtoBlob(dataurl: string) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Extracts time from OCR text
   * Searches for common time patterns like "18:18:09", "09:31:48", "18:18", etc.
   * Returns time in HH:MM format (hours and minutes only)
   */
  extractTimeFromOCR(ocrText: string): string | null {
    const lines = ocrText.split('\n');
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Look for lines with "uhrzeit:", "zeit:", "time:" markers
      if (lowerLine.includes('uhrzeit:') || lowerLine.includes('zeit:') || lowerLine.includes('time:')) {
        // Extract time after marker: "Uhrzeit: 18:18:09 Uhr" or "Zeit: 09:31"
        const timeMatch = line.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (timeMatch) {
          const hours = timeMatch[1].padStart(2, '0');
          const minutes = timeMatch[2];
          return `${hours}:${minutes}`;
        }
      }
      
      // Look for standalone time patterns (HH:MM:SS or HH:MM format)
      // Must be reasonable time (00-23 hours, 00-59 minutes)
      const timePattern = line.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:Uhr|uhr)?\b/);
      if (timePattern) {
        const hours = parseInt(timePattern[1], 10);
        const minutes = parseInt(timePattern[2], 10);
        
        // Validate time range
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          const hoursStr = hours.toString().padStart(2, '0');
          const minutesStr = minutes.toString().padStart(2, '0');
          return `${hoursStr}:${minutesStr}`;
        }
      }
    }
    
    return null; // No valid time found
  }

  /**
   * Normalizes price alignment in item lines
   * Makes all prices right-aligned by adding spaces before the price
   */
  normalizePriceAlignment(itemLines: string[]): string[] {
    const priceLines: { index: number; line: string; beforePrice: string; price: string }[] = [];
    
    // Identify all lines with prices and extract price parts
    itemLines.forEach((line, index) => {
      // Match price at end: "4007123560059 9.99 A" or "4006559394283                    39,99 A"
      const priceMatch = line.match(/^(.+?)(\s+)(\d+[,\.]\d{2}\s*€?\s*[A-Z]\s*)$/i);
      if (priceMatch) {
        priceLines.push({
          index: index,
          line: line,
          beforePrice: priceMatch[1],
          price: priceMatch[3]
        });
      }
    });
    
    // Find the longest line (to use as reference for padding)
    let maxLength = 0;
    priceLines.forEach(pl => {
      const totalLength = pl.beforePrice.length + pl.price.length;
      if (totalLength > maxLength) {
        maxLength = totalLength;
      }
    });
    
    // Use a mobile-friendly target length (30-35 chars works well on 390px+ screens)
    // For 375px screens, text may wrap but will still be readable
    const targetLength = Math.max(maxLength, 32);
    
    // Rebuild lines with normalized spacing
    const result = [...itemLines];
    priceLines.forEach(pl => {
      const spacesNeeded = targetLength - pl.beforePrice.length - pl.price.length;
      const padding = ' '.repeat(Math.max(1, spacesNeeded)); // At least 1 space
      result[pl.index] = pl.beforePrice + padding + pl.price;
    });
    
    return result;
  }

  async captureImage() {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera
    });
    this.image = image.dataUrl;
    await this.recognizeImage();
  }

  async pickImage() {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos
    });
    this.image = image.dataUrl;
    await this.recognizeImage();
  }

  static populateCategoryOptions() {
    const categories = new Set<string>();
    if (!Array.isArray(AppStateService.instance.allTransactions)) {
      AppStateService.instance.allTransactions = [];
    }
    for (let i = AppStateService.instance.allTransactions.length - 1; i >= 0; i--) {
      categories.add(AppStateService.instance.allTransactions[i].category);
    }

    AddComponent.categoryOptions = Array.from(categories).map(category => ({
      value: category,
      label: category.replace('@', '')
    }));
  }

  toggleCategoryOptions() {
    this.showCategoryOptions = !this.showCategoryOptions;
  }
  toggleCreditOptions() {
    this.showCreditOptions = !this.showCreditOptions;
  }
  toggleLoanOptions() {
    this.showLoanOptions = !this.showLoanOptions;
  }
  toggleShareOptions() {
    this.showShareOptions = !this.showShareOptions;
  }
  toggleIsTaxExpense() {
    AddComponent.isTaxExpense = !AddComponent.isTaxExpense;
    if (AddComponent.isTaxExpense) {
      AddComponent.isShare = false;
    }
  }
  toggleIsShare(){
    AddComponent.isShare = !AddComponent.isShare;
    if (AddComponent.isShare) {
      AddComponent.isTaxExpense = false;
    }
  }
  

  override highlight() {
    AddComponent.zIndex = AddComponent.zIndex + 1;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    InfoComponent.zIndex = 0;
  }

  override closeWindow() {
    AddComponent.isAdd = false;
    AddComponent.amountTextField = "";
    AddComponent.commentTextField = "";
    AddComponent.categoryTextField = "@";
    super.closeWindow();
  }

  /**
   * Handle amount field changes - update bucket allocation tags in comment if present
   */
  onAmountChange(newAmount: string) {
    // Check if comment contains a bucket allocation tag
    const bucketTagMatch = AddComponent.commentTextField?.match(/#bucket:([^:]+):([\d.]+)/);
    
    if (bucketTagMatch) {
      const bucketName = bucketTagMatch[1];
      const oldAmount = bucketTagMatch[2];
      
      // Get absolute value of new amount (negative for contributions)
      const newAbsAmount = Math.abs(parseFloat(newAmount) || 0);
      
      // Update the bucket allocation tag with new amount
      AddComponent.commentTextField = AddComponent.commentTextField.replace(
        `#bucket:${bucketName}:${oldAmount}`,
        `#bucket:${bucketName}:${newAbsAmount.toFixed(2)}`
      );
    }
  }

  addTransaction() {
    this.clearError();
    this.errorTextLable = "";

    // Per-field validation
    if (!this.validateRequired([
      { name: 'account', value: AddComponent.selectedOption, label: 'Account' },
      { name: 'amount', value: AddComponent.amountTextField, label: 'Amount' },
      { name: 'category', value: AddComponent.categoryTextField === '@' ? '' : AddComponent.categoryTextField, label: 'Category' }
    ])) {
      return;
    }

    // Close dialog immediately for instant UX - processing happens in next event loop
    AddComponent.isAdd = false;
    
    // Defer all processing to next event loop so Angular can update UI (hide dialog) first
    setTimeout(() => {
      try {
        // Only reload from localStorage if data is not already in memory (performance optimization)
        if (!AppStateService.instance.allRevenues || AppStateService.instance.allRevenues.length === 0) {
          AppStateService.instance.allRevenues = this.localStorage.getData("revenues") == "" ? [] : JSON.parse(this.localStorage.getData("revenues"));
        }
      if (!AppStateService.instance.allIntrests || AppStateService.instance.allIntrests.length === 0) {
        AppStateService.instance.allIntrests = this.localStorage.getData("interests") == "" ? [] : JSON.parse(this.localStorage.getData("interests"));
      }
      if (!AppStateService.instance.allProperties || AppStateService.instance.allProperties.length === 0) {
        AppStateService.instance.allProperties = this.localStorage.getData("properties") == "" ? [] : JSON.parse(this.localStorage.getData("properties"));
      }
      if (!AppStateService.instance.dailyExpenses || AppStateService.instance.dailyExpenses.length === 0) {
        AppStateService.instance.dailyExpenses = this.localStorage.getData("dailyEx") == "" ? [] : JSON.parse(this.localStorage.getData("dailyEx"));
      }
      if (!AppStateService.instance.splurgeExpenses || AppStateService.instance.splurgeExpenses.length === 0) {
        AppStateService.instance.splurgeExpenses = this.localStorage.getData("splurgeEx") == "" ? [] : JSON.parse(this.localStorage.getData("splurgeEx"));
      }
      if (!AppStateService.instance.smileExpenses || AppStateService.instance.smileExpenses.length === 0) {
        AppStateService.instance.smileExpenses = this.localStorage.getData("smileEx") == "" ? [] : JSON.parse(this.localStorage.getData("smileEx"));
      }
      if (!AppStateService.instance.fireExpenses || AppStateService.instance.fireExpenses.length === 0) {
        AppStateService.instance.fireExpenses = this.localStorage.getData("fireEx") == "" ? [] : JSON.parse(this.localStorage.getData("fireEx"));
      }
      if (!AppStateService.instance.mojoExpenses || AppStateService.instance.mojoExpenses.length === 0) {
        AppStateService.instance.mojoExpenses = this.localStorage.getData("mojoEx") == "" ? [] : JSON.parse(this.localStorage.getData("mojoEx"));
      }
      if (!AppStateService.instance.allAssets || AppStateService.instance.allAssets.length === 0) {
        AppStateService.instance.allAssets = this.localStorage.getData("assets") == "" ? [] : JSON.parse(this.localStorage.getData("assets"));
      }
      if (!AppStateService.instance.allShares || AppStateService.instance.allShares.length === 0) {
        AppStateService.instance.allShares = this.localStorage.getData("shares") == "" ? [] : JSON.parse(this.localStorage.getData("shares"));
      }
      if (!AppStateService.instance.allInvestments || AppStateService.instance.allInvestments.length === 0) {
        AppStateService.instance.allInvestments = this.localStorage.getData("investments") == "" ? [] : JSON.parse(this.localStorage.getData("investments"));
      }
      if (!AppStateService.instance.liabilities || AppStateService.instance.liabilities.length === 0) {
        AppStateService.instance.liabilities = this.localStorage.getData("liabilities") == "" ? [] : JSON.parse(this.localStorage.getData("liabilities"));
      }
      if (!AppStateService.instance.allSmileProjects || AppStateService.instance.allSmileProjects.length === 0) {
        AppStateService.instance.allSmileProjects = this.localStorage.getData("smile") == "" ? [] : migrateSmileArray(JSON.parse(this.localStorage.getData("smile")));
      }
      if (!AppStateService.instance.allFireEmergencies || AppStateService.instance.allFireEmergencies.length === 0) {
        AppStateService.instance.allFireEmergencies = this.localStorage.getData("fire") == "" ? [] : migrateFireArray(JSON.parse(this.localStorage.getData("fire")));
      }

      // Now process the transaction
      if (AddComponent.isShare) {
        if (AddComponent.shareTextField === "") {
        } else {
          if (this.showShareOptions){
            AddComponent.shareTextField = String(Math.round(parseFloat(AddComponent.amountTextField) * (parseFloat(AddComponent.shareTextField) / 100) * 100) / 100);
          }
          if (AddComponent.commentTextField != "") {
            AddComponent.commentTextField += "; ";
          }
          AddComponent.commentTextField += "shared " + AddComponent.amountTextField + " " + AppStateService.instance.currency;
          AddComponent.amountTextField = AddComponent.shareTextField;
        }
      }

      if (AddComponent.commentTextField.includes("Buy Asset")) {
        let split = AddComponent.commentTextField.split(" ");
        let title = split[2];
        let quantity = split[3];
        let price = split[5];
        let amount = parseFloat(quantity) * parseFloat(price)
        
        let found = false;
        for (let i = 0; i < AppStateService.instance.allAssets.length; i++) {
          if (AppStateService.instance.allAssets[i].tag === title) {
            AppStateService.instance.allAssets[i].amount += amount;
            found = true;
          }
        }
        if(!found){
          let newAsset = { tag: title, amount: amount }
          AppStateService.instance.allAssets.push(newAsset);
        }
        if(AddComponent.isLiabilitie){
          amount -= parseFloat(AddComponent.loanTextField);
        }
        AddComponent.amountTextField = `${amount*-1}`;
        
        for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
          if(AppStateService.instance.allGrowProjects[i].title === title){
            AppStateService.instance.allGrowProjects[i].status = "bought";
            if(found){
              AppStateService.instance.allGrowProjects[i].amount += amount;
            } else {
              AppStateService.instance.allGrowProjects[i].amount = amount;
            }
          }
        }
      }

      if (AddComponent.commentTextField.includes("Sell Asset")) {
        let split = AddComponent.commentTextField.split(" ");
        let title = split[2];
            let quantity = split[3];
            let price = split[5];
            let amount = parseFloat(quantity) * parseFloat(price);
            
            for (let i = 0; i < AppStateService.instance.allAssets.length; i++) {
              if (AppStateService.instance.allAssets[i].tag === title) {
                AppStateService.instance.allAssets[i].amount -= amount;
                AppStateService.instance.allAssets[i].amount = parseFloat(AppStateService.instance.allAssets[i].amount.toFixed(2));
                if (AppStateService.instance.allAssets[i].amount == 0) {
                  AppStateService.instance.allAssets.splice(i, 1);
                }
              }
            }
            AddComponent.amountTextField = `${amount}`;

            for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
              if(AppStateService.instance.allGrowProjects[i].title === title){
                AppStateService.instance.allGrowProjects[i].status = "sold";
              }
            }
          }

          if (AddComponent.commentTextField.includes("Buy Share")) {
            let split = AddComponent.commentTextField.split(" ");
            let title = split[2];
            let quantity = split[3];
            let price = split[5];
            let amount = parseFloat(quantity) * parseFloat(price);

            let found = false;
            for (let i = 0; i < AppStateService.instance.allShares.length; i++) {
              if (AppStateService.instance.allShares[i].tag === title) {
                AppStateService.instance.allShares[i].quantity = Number(AppStateService.instance.allShares[i].quantity) + parseFloat(quantity);
                AppStateService.instance.allShares[i].price = parseFloat(price);
                found = true;
              }
            }
            if(!found){
              let newShare: Share = { tag: title, quantity: parseFloat(quantity), price: parseFloat(price) }
              AppStateService.instance.allShares.push(newShare);
            }

            if(AddComponent.isLiabilitie){
              amount -= parseFloat(AddComponent.loanTextField);
            }
            AddComponent.amountTextField = `${amount*-1}`;

            for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
              if(AppStateService.instance.allGrowProjects[i].title === title){
                AppStateService.instance.allGrowProjects[i].status = "bought";
                AppStateService.instance.allGrowProjects[i].share.price = parseFloat(price);
                if(found){
                  AppStateService.instance.allGrowProjects[i].amount = Number(AppStateService.instance.allGrowProjects[i].amount) - parseFloat(AddComponent.amountTextField);
                  AppStateService.instance.allGrowProjects[i].share.quantity = Number(AppStateService.instance.allGrowProjects[i].share.quantity) + parseFloat(quantity);
                } else {
                  AppStateService.instance.allGrowProjects[i].share.quantity = parseFloat(quantity);
                  AppStateService.instance.allGrowProjects[i].amount = parseFloat(quantity) * parseFloat(price);
                }
              }
            }
          }

          if (AddComponent.commentTextField.includes("Dividende Share")) {
            let split = AddComponent.commentTextField.split(" ");
            let title = split[2];
            let quantity = split[3];
            let price = split[5];
            let amount = parseFloat(quantity) * parseFloat(price);

            AddComponent.amountTextField = `${amount}`;
          }

          if (AddComponent.commentTextField.includes("Sell Share")) {
            let split = AddComponent.commentTextField.split(" ");
            let title = split[2];
            let quantity = split[3];
            let price = split[5];
            let amount = parseFloat(quantity) * parseFloat(price);
            for (let i = 0; i < AppStateService.instance.allShares.length; i++) {
              if (AppStateService.instance.allShares[i].tag === title) {
                AppStateService.instance.allShares[i].quantity -= parseFloat(quantity);
                AppStateService.instance.allShares[i].quantity = parseFloat(AppStateService.instance.allShares[i].quantity.toFixed(2));
                if (AppStateService.instance.allShares[i].quantity == 0) {
                  AppStateService.instance.allShares.splice(i, 1);
                } else {
                  AppStateService.instance.allShares[i].price = parseFloat(price);
                }
              }
            }

            for(let i=0; i < AppStateService.instance.allGrowProjects.length; i++){
              if(AppStateService.instance.allGrowProjects[i].title === title){
                AppStateService.instance.allGrowProjects[i].status = "sold";
                AppStateService.instance.allGrowProjects[i].share.price = parseFloat(price);
                AppStateService.instance.allGrowProjects[i].share.quantity -= parseFloat(quantity);
              }
            }
            
            AddComponent.amountTextField = `${amount}`;
          }

          if (AddComponent.commentTextField.includes("Buy Investment")) {
            let split = AddComponent.commentTextField.split(" ");
            let title = split[2];
            let deposit = split[3];
            let mortage = split[4];

            let found = false;
            for (let i = 0; i < AppStateService.instance.allInvestments.length; i++) {
              if (AppStateService.instance.allInvestments[i].tag === title) {
                AppStateService.instance.allInvestments[i].deposit = Number(AppStateService.instance.allInvestments[i].deposit) + parseFloat(deposit);
                AppStateService.instance.allInvestments[i].amount = Number(AppStateService.instance.allInvestments[i].amount) + parseFloat(mortage);
                found = true;
              }
            }
            if(!found){
              let newInvestment: Investment = { tag: title, deposit: parseFloat(deposit), amount: parseFloat(mortage) }
              AppStateService.instance.allInvestments.push(newInvestment);
            }

            let foundM = false;
            for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
              if (AppStateService.instance.liabilities[i].tag === "M-"+title) {
                AppStateService.instance.liabilities[i].amount = Number(AppStateService.instance.liabilities[i].amount) + parseFloat(mortage);
                foundM = true;
              }
            }
            if(!foundM){
              let newLiabilitie: Liability = { tag: "M-"+title, amount: parseFloat(mortage), investment: true, credit: 0 }
              AppStateService.instance.liabilities.push(newLiabilitie);
            }

            let amount = parseFloat(deposit);
            if(AddComponent.isLiabilitie){
              amount -= parseFloat(AddComponent.loanTextField);
            }
            AddComponent.amountTextField = `${amount*-1}`;

            for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
              if(AppStateService.instance.allGrowProjects[i].title === title){
                AppStateService.instance.allGrowProjects[i].status = "bought";
                if(found){
                  AppStateService.instance.allGrowProjects[i].amount -= parseFloat(AddComponent.amountTextField);
                  AppStateService.instance.allGrowProjects[i].investment.deposit = Number(AppStateService.instance.allGrowProjects[i].investment.deposit) + parseFloat(deposit);
                  AppStateService.instance.allGrowProjects[i].investment.amount = Number(AppStateService.instance.allGrowProjects[i].investment.amount) + parseFloat(mortage);
                } else {
                  AppStateService.instance.allGrowProjects[i].amount = amount;
                  AppStateService.instance.allGrowProjects[i].investment.deposit = parseFloat(deposit);
                  AppStateService.instance.allGrowProjects[i].investment.amount = parseFloat(mortage);
                }
              }
            }
          }

          // Handle @Mojo category - can add to Mojo from any account
          if (AddComponent.categoryTextField === "@Mojo") {
            AddComponent.amountTextField = String(this.returnCorrectMojo());
            this.addToMojo();
          }

          // Handle Smile projects - can add from any account
          // Don't adjust amount if user has manual bucket allocations (let addToSmileProject handle capping)
          const hasManualBucketAllocation = AddComponent.commentTextField?.includes('#bucket:');
          if (!hasManualBucketAllocation) {
            AddComponent.amountTextField = String(this.returnCorrectSmileAmount());
          }
          this.addToSmileProject(AddComponent.categoryTextField);

          // Handle Fire emergencies - can add from any account
          AddComponent.amountTextField = String(this.returnCorrectFireAmount());
          this.addToFireEmergencie(AddComponent.categoryTextField);

          // If spending FROM Mojo account, remove from Mojo fund
          if (AddComponent.selectedOption === "Mojo") {
            this.removeFromMojo();
          }

          let isInvesmtent = false;
          if(AddComponent.isLiabilitie){
            if(this.showLoanOptions){
                if (AddComponent.loanTextField === "") {
                  AddComponent.loanTextField = "0";
                }
                AddComponent.loanTextField = String(Math.round(parseFloat(AddComponent.amountTextField) * -1 * (parseFloat(AddComponent.loanTextField) / 100) * 100) / 100);
                AddComponent.amountTextField = String(parseFloat(AddComponent.amountTextField)+parseFloat(AddComponent.loanTextField));
            }
            
            if(this.showCreditOptions){
                if (AddComponent.creditTextField === "") {
                  AddComponent.creditTextField = "0";
                }
                AddComponent.creditTextField = String(Math.round(parseFloat(AddComponent.loanTextField) * (parseFloat(AddComponent.creditTextField) / 100) * 100) / 100);
            }
            if(AddComponent.creditTextField === ""){
              AddComponent.creditTextField = "0";
            }

            let found = false;
            for(let i=0; i < AppStateService.instance.liabilities.length; i++){
              if("@" + AppStateService.instance.liabilities[i].tag.toLowerCase() === AddComponent.categoryTextField.toLowerCase()){
                found = true;
                AppStateService.instance.liabilities[i].amount += parseFloat(AddComponent.loanTextField);
                AppStateService.instance.liabilities[i].credit += parseFloat(AddComponent.creditTextField);
                AppStateService.instance.liabilities[i].amount = parseFloat(AppStateService.instance.liabilities[i].amount.toFixed(2));
                AppStateService.instance.liabilities[i].credit = parseFloat(AppStateService.instance.liabilities[i].credit.toFixed(2));
                for(let e=0; e < AppStateService.instance.allGrowProjects.length; e++){
                  if(AppStateService.instance.allGrowProjects[e].title === AddComponent.categoryTextField.replace("@","")){
                    AppStateService.instance.allGrowProjects[e].liabilitie.amount = AppStateService.instance.liabilities[i].amount;
                    AppStateService.instance.allGrowProjects[e].liabilitie.credit = AppStateService.instance.liabilities[i].credit;
                  }
                }
              }
            }
            
            if(!found){
              for(let i=0; i < AppStateService.instance.allAssets.length; i++){
                if("@" + AppStateService.instance.allAssets[i].tag.toLowerCase() === AddComponent.categoryTextField.toLowerCase()){
                  isInvesmtent = true;
                }
              }
              for(let i=0; i < AppStateService.instance.allShares.length; i++){
                if("@" + AppStateService.instance.allShares[i].tag.toLowerCase() === AddComponent.categoryTextField.toLowerCase()){
                  isInvesmtent = true;
                }
              }
              for(let i=0; i < AppStateService.instance.allInvestments.length; i++){
                if("@" + AppStateService.instance.allInvestments[i].tag.toLowerCase() === AddComponent.categoryTextField.toLowerCase()){
                  isInvesmtent = true;
                }
              }
              let newLiabilitie: Liability = {tag: AddComponent.categoryTextField.replace("@",""), amount: parseFloat(AddComponent.loanTextField), investment: isInvesmtent, credit: parseFloat(AddComponent.creditTextField)};
              AppStateService.instance.liabilities.push(newLiabilitie);
              for(let e=0; e < AppStateService.instance.allGrowProjects.length; e++){
                if(AppStateService.instance.allGrowProjects[e].title === AddComponent.categoryTextField.replace("@","")){
                  AppStateService.instance.allGrowProjects[e].liabilitie.amount = parseFloat(AddComponent.loanTextField);
                  AppStateService.instance.allGrowProjects[e].liabilitie.credit = parseFloat(AddComponent.creditTextField);
                }
              }
            }
            AddComponent.commentTextField =  "Liabilitie " + AddComponent.loanTextField + " " + AddComponent.creditTextField +"; " + AddComponent.commentTextField;
          }

          if(AddComponent.commentTextField.includes("Payback Liabilitie")){
            let split = AddComponent.commentTextField.split(" ");
            let amount = 0.0;
            if (split[2].includes("%")) {
              for(let i=0; i < AppStateService.instance.liabilities.length; i++){
                if("@"+AppStateService.instance.liabilities[i].tag === AddComponent.categoryTextField){
                  amount = AppStateService.instance.liabilities[i].amount * (parseFloat(split[2])/100);
                }
              }
            } else {
              amount = parseFloat(split[2]);
            }
            let credit = 0.0;
            if(split[3].includes("%")){
              for(let i=0; i < AppStateService.instance.liabilities.length; i++){
                if("@"+AppStateService.instance.liabilities[i].tag === AddComponent.categoryTextField){
                  credit = AppStateService.instance.liabilities[i].credit * (parseFloat(split[3])/100);
                }
              }
            } else {
              credit = parseFloat(split[3]);
            }
            for(let i=0; i < AppStateService.instance.liabilities.length; i++){
              if("@"+AppStateService.instance.liabilities[i].tag === AddComponent.categoryTextField){
                AppStateService.instance.liabilities[i].amount -= amount;
                AppStateService.instance.liabilities[i].credit -= credit;
                AppStateService.instance.liabilities[i].amount = parseFloat(AppStateService.instance.liabilities[i].amount.toFixed(2));
                AppStateService.instance.liabilities[i].credit = parseFloat(AppStateService.instance.liabilities[i].credit.toFixed(2));
              }
              if(AppStateService.instance.liabilities[i].amount === 0 && AppStateService.instance.liabilities[i].credit === 0){
                AppStateService.instance.liabilities.splice(i, 1);
              }
            }


            if(!AddComponent.commentTextField.includes("Sell Investment")){
              AddComponent.amountTextField = String((amount + credit)*-1);
              AddComponent.commentTextField = "Payback Liabilitie " + amount+ " " + credit + ";";
            }

            for(let i=0; i < AppStateService.instance.allGrowProjects.length; i++){
              if(AppStateService.instance.allGrowProjects[i].title === AddComponent.categoryTextField.replace("@","")){
                AppStateService.instance.allGrowProjects[i].status = "paid back";

                AppStateService.instance.allGrowProjects[i].amount = Number(AppStateService.instance.allGrowProjects[i].amount) + amount;
                AppStateService.instance.allGrowProjects[i].liabilitie.amount -= amount;
                AppStateService.instance.allGrowProjects[i].liabilitie.credit -= credit;

                AppStateService.instance.allGrowProjects[i].liabilitie.amount = parseFloat(AppStateService.instance.allGrowProjects[i].liabilitie.amount.toFixed(2));
                AppStateService.instance.allGrowProjects[i].liabilitie.credit = parseFloat(AppStateService.instance.allGrowProjects[i].liabilitie.credit.toFixed(2));
                if(AppStateService.instance.allGrowProjects[i].liabilitie.amount === 0 && AppStateService.instance.allGrowProjects[i].liabilitie.credit === 0){
                  AppStateService.instance.allGrowProjects[i].liabilitie = null;
                  AppStateService.instance.allGrowProjects[i].status = "paid off";
                }
              }
            }

          }

          if (AddComponent.commentTextField.includes("Sell Investment")) {
            let clean_comment = AddComponent.commentTextField;
            if(clean_comment.includes("Payback Liabilitie")){
              let clean_split = clean_comment.split("; ");
              clean_comment = clean_split[1];
            }
            let split = clean_comment.split(" ");
            let title = split[2];
            let deposit = split[3];
            let mortage = split[4];
            for (let i = 0; i < AppStateService.instance.allInvestments.length; i++) {
              if (AppStateService.instance.allInvestments[i].tag === title) {
                AppStateService.instance.allInvestments[i].deposit -= parseFloat(deposit);
                AppStateService.instance.allInvestments[i].deposit = parseFloat(AppStateService.instance.allInvestments[i].deposit.toFixed(2));
                AppStateService.instance.allInvestments[i].amount -= parseFloat(mortage);
                AppStateService.instance.allInvestments[i].amount = parseFloat(AppStateService.instance.allInvestments[i].amount.toFixed(2));
                if (AppStateService.instance.allInvestments[i].deposit == 0 && AppStateService.instance.allInvestments[i].amount == 0) {
                  AppStateService.instance.allInvestments.splice(i, 1);
                }
              }
            }
            for(let i=0; i<AppStateService.instance.liabilities.length; i++){
              if(AppStateService.instance.liabilities[i].tag === "M-"+title){
                AppStateService.instance.liabilities[i].amount -= parseFloat(mortage);
                AppStateService.instance.liabilities[i].amount = parseFloat(AppStateService.instance.liabilities[i].amount.toFixed(2));
                if (AppStateService.instance.liabilities[i].amount == 0) {
                  AppStateService.instance.liabilities.splice(i, 1);
                }
              }
            }

            let profit = parseFloat(deposit);
            if(AddComponent.commentTextField.includes("Payback Liabilitie")){
              let liabilitie_split = AddComponent.commentTextField.split(" ");
              let loan = liabilitie_split[2];
              let credit = liabilitie_split[3]; 
              profit = parseFloat(deposit) - parseFloat(loan) - parseFloat(credit)
            }

            for(let i=0; i < AppStateService.instance.allGrowProjects.length; i++){
              if(AppStateService.instance.allGrowProjects[i].title === title){
                AppStateService.instance.allGrowProjects[i].status = "sold";
                AppStateService.instance.allGrowProjects[i].amount -= parseFloat(deposit);
                if(AppStateService.instance.allGrowProjects[i].amount < 0){
                  AppStateService.instance.allGrowProjects[i].amount = 0;
                }
                AppStateService.instance.allGrowProjects[i].investment.deposit -= parseFloat(deposit);
                AppStateService.instance.allGrowProjects[i].investment.amount -= parseFloat(mortage);
              }
            }
            
            AddComponent.commentTextField += ` CASHFLOW: ${AddComponent.amountTextField};`
            AddComponent.amountTextField = `${parseFloat(AddComponent.amountTextField) + profit}`;
          }

          if(AddComponent.amountTextField != "0" && AddComponent.amountTextField != ""){

            //Calculating Revenue
            if (AddComponent.selectedOption === "Income") {
              // check in shares to add
              let found = false;
              for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
                if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.allIntrests[i].tag.toLocaleLowerCase()) {
                  found = true;
                  AppStateService.instance.allIntrests[i].amount += parseFloat(AddComponent.amountTextField);
                  this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                    itemType: 'interest',
                    itemTag: AppStateService.instance.allIntrests[i].tag,
                    amount: parseFloat(AddComponent.amountTextField),
                    newTotal: AppStateService.instance.allIntrests[i].amount,
                    operation: 'update',
                    source: 'add_transaction'
                  });
                }
              }
              if(!found) {
                // check in properties to add
                for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
                  if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.allProperties[i].tag.toLocaleLowerCase()) {
                    found = true;
                    AppStateService.instance.allProperties[i].amount += parseFloat(AddComponent.amountTextField);
                    this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                      itemType: 'property',
                      itemTag: AppStateService.instance.allProperties[i].tag,
                      amount: parseFloat(AddComponent.amountTextField),
                      newTotal: AppStateService.instance.allProperties[i].amount,
                      operation: 'update',
                      source: 'add_transaction'
                    });
                  }
                }
              }
              if(!found){
                 // check in revenues to add
                 for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
                  if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.allRevenues[i].tag.toLocaleLowerCase()) {
                    found = true;
                    AppStateService.instance.allRevenues[i].amount += parseFloat(AddComponent.amountTextField);
                    this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                      itemType: 'revenue',
                      itemTag: AppStateService.instance.allRevenues[i].tag,
                      amount: parseFloat(AddComponent.amountTextField),
                      newTotal: AppStateService.instance.allRevenues[i].amount,
                      operation: 'update',
                      source: 'add_transaction'
                    });
                  }
                }
              }
              if(!found){
                // Check if Interest 
                for (let i = 0; i < AppStateService.instance.allShares.length; i++) {
                  if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.allShares[i].tag.toLocaleLowerCase()) {
                    found = true;
                    let newInterest: Interest = { tag: AppStateService.instance.allShares[i].tag, amount: parseFloat(AddComponent.amountTextField) }
                    AppStateService.instance.allIntrests.push(newInterest);
                    this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                      itemType: 'interest',
                      itemTag: newInterest.tag,
                      amount: newInterest.amount,
                      newTotal: newInterest.amount,
                      operation: 'create',
                      source: 'add_transaction'
                    });
                  }
                }
              }
              if(!found){
                // Check if Propertie 
                for (let i = 0; i < AppStateService.instance.allInvestments.length; i++) {
                  if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.allInvestments[i].tag.toLocaleLowerCase()) {
                    found = true;
                    let newPropertie: Property = { tag: AppStateService.instance.allInvestments[i].tag, amount: parseFloat(AddComponent.amountTextField) }
                    AppStateService.instance.allProperties.push(newPropertie);
                    this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                      itemType: 'property',
                      itemTag: newPropertie.tag,
                      amount: newPropertie.amount,
                      newTotal: newPropertie.amount,
                      operation: 'create',
                      source: 'add_transaction'
                    });
                  }
                }
              }
              if(!found){
                // Check Grow Projects
                for(let i = 0; i < AppStateService.instance.allGrowProjects.length; i++){
                  if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.allGrowProjects[i].title.toLocaleLowerCase()) {
                    found = true;
                    if(AppStateService.instance.allGrowProjects[i].share){
                      let newInterest: Interest = { tag: AppStateService.instance.allGrowProjects[i].title, amount: parseFloat(AddComponent.amountTextField) }
                      AppStateService.instance.allIntrests.push(newInterest);
                      this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                        itemType: 'interest',
                        itemTag: newInterest.tag,
                        amount: newInterest.amount,
                        newTotal: newInterest.amount,
                        operation: 'create',
                        source: 'add_transaction'
                      });
                    }
                    if(AppStateService.instance.allGrowProjects[i].investment){
                      let newPropertie: Property = { tag: AppStateService.instance.allGrowProjects[i].title, amount: parseFloat(AddComponent.amountTextField) }
                      AppStateService.instance.allProperties.push(newPropertie);
                      this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                        itemType: 'property',
                        itemTag: newPropertie.tag,
                        amount: newPropertie.amount,
                        newTotal: newPropertie.amount,
                        operation: 'create',
                        source: 'add_transaction'
                      });
                    }
                  }
                }
              }
              // else add new to reveneus
              if (!found) {
                let new_revenue: Revenue = { tag: this.classReference.categoryTextField.replace("@", ""), amount: parseFloat(AddComponent.amountTextField) }
                AppStateService.instance.allRevenues.push(new_revenue);
                this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                  itemType: 'revenue',
                  itemTag: new_revenue.tag,
                  amount: new_revenue.amount,
                  newTotal: new_revenue.amount,
                  operation: 'create',
                  source: 'add_transaction'
                });
                found = true;
              }
            }

            // Calculating Daily Expenses
            if (AddComponent.selectedOption === "Daily") {
              let found = false;
              while (!found) {
                //check dailyEx
                for (let i = 0; i < AppStateService.instance.dailyExpenses.length; i++) {
                  if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.dailyExpenses[i].tag.toLocaleLowerCase()) {
                    found = true;
                    AppStateService.instance.dailyExpenses[i].amount += parseFloat(AddComponent.amountTextField);
                    this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                      itemType: 'dailyExpense',
                      itemTag: AppStateService.instance.dailyExpenses[i].tag,
                      amount: parseFloat(AddComponent.amountTextField),
                      newTotal: AppStateService.instance.dailyExpenses[i].amount,
                      operation: 'update',
                      source: 'add_transaction'
                    });
                  }
                }
                //else add to dailyEx
                if (!found) {
                  let new_expense: Expense = { tag: this.classReference.categoryTextField.replace("@", ""), amount: parseFloat(AddComponent.amountTextField) }
                  AppStateService.instance.dailyExpenses.push(new_expense);
                  this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                    itemType: 'dailyExpense',
                    itemTag: new_expense.tag,
                    amount: new_expense.amount,
                    newTotal: new_expense.amount,
                    operation: 'create',
                    source: 'add_transaction'
                  });
                  found = true;
                }
              }
            }
            // Calculating Splurge Expenses
            if (AddComponent.selectedOption === "Splurge") {
              let found = false;
              while (!found) {
                //check splurgeEx
                for (let i = 0; i < AppStateService.instance.splurgeExpenses.length; i++) {
                  if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.splurgeExpenses[i].tag.toLocaleLowerCase()) {
                    found = true;
                    AppStateService.instance.splurgeExpenses[i].amount += parseFloat(AddComponent.amountTextField);
                    this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                      itemType: 'splurgeExpense',
                      itemTag: AppStateService.instance.splurgeExpenses[i].tag,
                      amount: parseFloat(AddComponent.amountTextField),
                      newTotal: AppStateService.instance.splurgeExpenses[i].amount,
                      operation: 'update',
                      source: 'add_transaction'
                    });
                  }
                }
                //else add to splurgeEx
                if (!found) {
                  let new_expense: Expense = { tag: this.classReference.categoryTextField.replace("@", ""), amount: parseFloat(AddComponent.amountTextField) }
                  AppStateService.instance.splurgeExpenses.push(new_expense);
                  this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                    itemType: 'splurgeExpense',
                    itemTag: new_expense.tag,
                    amount: new_expense.amount,
                    newTotal: new_expense.amount,
                    operation: 'create',
                    source: 'add_transaction'
                  });
                  found = true;
                }
              }
            }
            // Calculating Smile Expenses
            if (AddComponent.selectedOption === "Smile") {
              let found = false;
              while (!found) {
                //check smileEx
                for (let i = 0; i < AppStateService.instance.smileExpenses.length; i++) {
                  if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.smileExpenses[i].tag.toLocaleLowerCase()) {
                    found = true;
                    AppStateService.instance.smileExpenses[i].amount += parseFloat(AddComponent.amountTextField);
                    this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                      itemType: 'smileExpense',
                      itemTag: AppStateService.instance.smileExpenses[i].tag,
                      amount: parseFloat(AddComponent.amountTextField),
                      newTotal: AppStateService.instance.smileExpenses[i].amount,
                      operation: 'update',
                      source: 'add_transaction'
                    });
                  }
                }
                //else add to smileEx
                if (!found) {
                  let new_expense: Expense = { tag: this.classReference.categoryTextField.replace("@", ""), amount: parseFloat(AddComponent.amountTextField) }
                  AppStateService.instance.smileExpenses.push(new_expense);
                  this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                    itemType: 'smileExpense',
                    itemTag: new_expense.tag,
                    amount: new_expense.amount,
                    newTotal: new_expense.amount,
                    operation: 'create',
                    source: 'add_transaction'
                  });
                  found = true;
                }
              }
            }
            // Calculating Fire Expenses
            if (AddComponent.selectedOption === "Fire") {
              let found = false;
              while (!found) {
                //check fireEx
                for (let i = 0; i < AppStateService.instance.fireExpenses.length; i++) {
                  if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.fireExpenses[i].tag.toLocaleLowerCase()) {
                    found = true;
                    AppStateService.instance.fireExpenses[i].amount += parseFloat(AddComponent.amountTextField);
                    this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                      itemType: 'fireExpense',
                      itemTag: AppStateService.instance.fireExpenses[i].tag,
                      amount: parseFloat(AddComponent.amountTextField),
                      newTotal: AppStateService.instance.fireExpenses[i].amount,
                      operation: 'update',
                      source: 'add_transaction'
                    });
                  }
                }
                //else add to fireEx
                if (!found) {
                  let new_expense: Expense = { tag: this.classReference.categoryTextField.replace("@", ""), amount: parseFloat(AddComponent.amountTextField) }
                  AppStateService.instance.fireExpenses.push(new_expense);
                  this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                    itemType: 'fireExpense',
                    itemTag: new_expense.tag,
                    amount: new_expense.amount,
                    newTotal: new_expense.amount,
                    operation: 'create',
                    source: 'add_transaction'
                  });
                  found = true;
                }
              }
            }
            // Calculating Mojo Expenses
            if (AddComponent.selectedOption === "Mojo") {
              let found = false;
              while (!found) {
                //check mojoEx
                for (let i = 0; i < AppStateService.instance.mojoExpenses.length; i++) {
                  if (this.classReference.categoryTextField.toLocaleLowerCase() === "@" + AppStateService.instance.mojoExpenses[i].tag.toLocaleLowerCase()) {
                    found = true;
                    AppStateService.instance.mojoExpenses[i].amount += parseFloat(AddComponent.amountTextField);
                    this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                      itemType: 'mojoExpense',
                      itemTag: AppStateService.instance.mojoExpenses[i].tag,
                      amount: parseFloat(AddComponent.amountTextField),
                      newTotal: AppStateService.instance.mojoExpenses[i].amount,
                      operation: 'update',
                      source: 'add_transaction'
                    });
                  }
                }
                //else add to mojoEx
                if (!found) {
                  let new_expense: Expense = { tag: this.classReference.categoryTextField.replace("@", ""), amount: parseFloat(AddComponent.amountTextField) }
                  AppStateService.instance.mojoExpenses.push(new_expense);
                  this.frontendLogger.logActivity('update_income_statement_item', 'info', {
                    itemType: 'mojoExpense',
                    itemTag: new_expense.tag,
                    amount: new_expense.amount,
                    newTotal: new_expense.amount,
                    operation: 'create',
                    source: 'add_transaction'
                  });
                  found = true;
                }
              }
            }
          }

          if(AddComponent.isTaxExpense){
            AddComponent.commentTextField += "; Werbungskosten";
          }

          

          // ready to write to Database new Transaction
          let newTransaction: Transaction = { account: AddComponent.selectedOption, amount: parseFloat(AddComponent.amountTextField), date: this.dateTextField, time: this.timeTextField, category: AddComponent.categoryTextField, comment: AddComponent.commentTextField }
          AppStateService.instance.allTransactions.push(newTransaction);
          
          // After transaction is added, update it with smart bucket allocation tags
          // This must happen AFTER push so we can access and modify the transaction
          this.updateTransactionWithAllocationTags(newTransaction, AddComponent.categoryTextField);
          
          // Log the add transaction activity
          this.frontendLogger.logDataOperation('add', 'transaction', undefined, {
            account: newTransaction.account,
            amount: newTransaction.amount,
            category: newTransaction.category,
            date: newTransaction.date
          });
          
          AccountingComponent.allTransactions = AppStateService.instance.allTransactions;
          
          AccountingComponent.dataSource.data = [...AppStateService.instance.allTransactions];
          AccountingComponent.dataSource.data = AccountingComponent.dataSource.data.map((transaction, index) => {
            return { ...transaction, id: index };
          });
          DailyComponent.updateDailyAmount();

          // Clean Up close Window
          this.dateTextField = this.d.getFullYear() + "-" + this.zeroPadded(this.d.getMonth() + 1) + "-" + this.zeroPadded(this.d.getDate());
          this.timeTextField = "";
          AddComponent.selectedOption = "Daily";
          AddComponent.amountTextField = "";
          AddComponent.commentTextField = "";
          AddComponent.categoryTextField = "@";
          this.color = "black";
          this.borderColor = "var(--color-border)";
          AddComponent.isError = false;
          try {
            //WRITE to Storage
            // In selfhosted mode, writeObject returns Observable that must be subscribed
            // In firebase mode, writeObject returns void and executes immediately
            // Only write balance/grow data if it has been loaded (Tier 3 on-demand).
            // Writing before load would overwrite real DB data with empty arrays.
            const writes = [
              { tag: "income/revenue/interests", data: AppStateService.instance.allIntrests },
              { tag: "income/revenue/properties", data: AppStateService.instance.allProperties },
              { tag: "income/revenue/revenues", data: AppStateService.instance.allRevenues },
              { tag: "income/expenses/daily", data: AppStateService.instance.dailyExpenses },
              { tag: "income/expenses/splurge", data: AppStateService.instance.splurgeExpenses },
              // Only write tier2 data (smile/fire/mojo) if tier2 has been loaded.
              // Writing before load would overwrite real DB data with empty defaults.
              ...(AppStateService.instance.tier2Loaded ? [
                { tag: "income/expenses/smile", data: AppStateService.instance.smileExpenses },
                { tag: "income/expenses/fire", data: AppStateService.instance.fireExpenses },
                { tag: "income/expenses/mojo", data: AppStateService.instance.mojoExpenses },
                { tag: "smile", data: AppStateService.instance.allSmileProjects },
                { tag: "fire", data: AppStateService.instance.allFireEmergencies },
                { tag: "mojo", data: AppStateService.instance.mojo },
              ] : []),
              { tag: "transactions", data: AppStateService.instance.allTransactions },
              ...(AppStateService.instance.tier3BalanceLoaded ? [
                { tag: "balance/liabilities", data: AppStateService.instance.liabilities },
                { tag: "balance/asset/shares", data: AppStateService.instance.allShares },
                { tag: "balance/asset/assets", data: AppStateService.instance.allAssets },
                { tag: "balance/asset/investments", data: AppStateService.instance.allInvestments }
              ] : []),
              ...(AppStateService.instance.tier3GrowLoaded ? [
                { tag: "grow", data: AppStateService.instance.allGrowProjects }
              ] : [])
            ];

            if (this.mode === 'firebase') {
              // Firebase mode - save to localStorage first
              this.saveToLocalStorage();
              
              // Close dialog and show spinner
              this.closeWindowAndNavigate();
              AppStateService.instance.isSaving = true;
              
              // Then write to database
              writes.forEach(write => {
                this.database.writeObject(write.tag, write.data);
              });
              AppStateService.instance.isSaving = false;
              this.toastService.show('Transaction added successfully', 'success');
            } else {
              // Selfhosted mode - save to localStorage first
              this.saveToLocalStorage();
              
              // Close dialog and show spinner
              this.closeWindowAndNavigate();
              AppStateService.instance.isSaving = true;

              // Execute batch write in background (only writes changed data)
              this.database.batchWrite(writes).subscribe({
                next: (result) => {
                  if (result.skipped) {
                  } else {
                  }
                  // Log user activity
                  this.frontendLogger.logActivity('add_transaction', 'info', {
                    account: AddComponent.selectedOption,
                    category: AddComponent.categoryTextField,
                    amount: AddComponent.amountTextField,
                    date: this.dateTextField
                  });
                  AppStateService.instance.isSaving = false;
                  this.toastService.show('Transaction added successfully', 'success');
                },
                error: (error) => {
                  AppStateService.instance.isSaving = false;
                  this.toastService.show('Failed to sync to database', 'error');
                  console.error('Error writing data to database:', error);
                }
              });
            }

          } catch (error) {
            AppStateService.instance.isSaving = false;
            this.toastService.show('Error writing to database', 'error');
            console.error('Error in database write:', error);
          }
        } catch (error) {
          console.error('Error in addTransaction:', error);
          alert('Error: ' + (error.message || error));
        }
      }, 0); // End setTimeout - allows UI to update before processing
  }

  /**
   * Save all data to localStorage
   */
  private saveToLocalStorage() {
    this.localStorage.saveData("interests", JSON.stringify(AppStateService.instance.allIntrests))
    this.localStorage.saveData("properties", JSON.stringify(AppStateService.instance.allProperties))
    this.localStorage.saveData("revenues", JSON.stringify(AppStateService.instance.allRevenues))
    this.localStorage.saveData("dailyEx", JSON.stringify(AppStateService.instance.dailyExpenses))
    this.localStorage.saveData("splurgeEx", JSON.stringify(AppStateService.instance.splurgeExpenses))
    // Only save tier2 data if loaded
    if (AppStateService.instance.tier2Loaded) {
      this.localStorage.saveData("smileEx", JSON.stringify(AppStateService.instance.smileExpenses))
      this.localStorage.saveData("fireEx", JSON.stringify(AppStateService.instance.fireExpenses))
      this.localStorage.saveData("mojoEx", JSON.stringify(AppStateService.instance.mojoExpenses))
      this.localStorage.saveData("smile", JSON.stringify(AppStateService.instance.allSmileProjects))
      this.localStorage.saveData("fire", JSON.stringify(AppStateService.instance.allFireEmergencies))
      this.localStorage.saveData("mojo", JSON.stringify(AppStateService.instance.mojo))
    }
    this.localStorage.saveData("transactions", JSON.stringify(AppStateService.instance.allTransactions))
    // Only save balance/grow data to localStorage if it has been loaded (Tier 3 on-demand).
    // Saving before load would overwrite real localStorage data with empty arrays.
    if (AppStateService.instance.tier3BalanceLoaded) {
      this.localStorage.saveData("liabilities", JSON.stringify(AppStateService.instance.liabilities))
      this.localStorage.saveData("shares", JSON.stringify(AppStateService.instance.allShares))
      this.localStorage.saveData("assets", JSON.stringify(AppStateService.instance.allAssets))
      this.localStorage.saveData("investments", JSON.stringify(AppStateService.instance.allInvestments))
    }
    if (AppStateService.instance.tier3GrowLoaded) {
      this.localStorage.saveData("grow", JSON.stringify(AppStateService.instance.allGrowProjects))
    }
  }

  /**
   * Close dialog and navigate
   */
  private closeWindowAndNavigate() {
    this.showCategoryOptions = false;
    this.showCreditOptions = false;
    this.showShareOptions = true;
    AddComponent.isLiabilitie = false;
    AddComponent.isShare = false;
    AddComponent.creditTextField = "";
    AddComponent.shareTextField = "50";
    this.closeWindow();
    AppComponent.gotoTop();
    this.router.navigate([AddComponent.url]);
  }

  /**
   * Finalize the add transaction - save to local storage and navigate
   * @deprecated Use saveToLocalStorage() and closeWindowAndNavigate() separately
   */
  private finalizeAddTransaction() {
    if (!AddComponent.isError) {
      this.showCategoryOptions = false;
      this.showCreditOptions = false;
      this.showShareOptions = true;
      AddComponent.isLiabilitie = false;
      AddComponent.isShare = false;
      AddComponent.creditTextField = "";
      AddComponent.shareTextField = "50";
      this.localStorage.saveData("interests", JSON.stringify(AppStateService.instance.allIntrests))
      this.localStorage.saveData("properties", JSON.stringify(AppStateService.instance.allProperties))
      this.localStorage.saveData("revenues", JSON.stringify(AppStateService.instance.allRevenues))
      this.localStorage.saveData("liabilities", JSON.stringify(AppStateService.instance.liabilities))
      this.localStorage.saveData("dailyEx", JSON.stringify(AppStateService.instance.dailyExpenses))
      this.localStorage.saveData("splurgeEx", JSON.stringify(AppStateService.instance.splurgeExpenses))
      this.localStorage.saveData("smileEx", JSON.stringify(AppStateService.instance.smileExpenses))
      this.localStorage.saveData("fireEx", JSON.stringify(AppStateService.instance.fireExpenses))
      this.localStorage.saveData("mojoEx", JSON.stringify(AppStateService.instance.mojoExpenses))
      this.localStorage.saveData("smile", JSON.stringify(AppStateService.instance.allSmileProjects))
      this.localStorage.saveData("fire", JSON.stringify(AppStateService.instance.allFireEmergencies))
      this.localStorage.saveData("mojo", JSON.stringify(AppStateService.instance.mojo))
      this.localStorage.saveData("transactions", JSON.stringify(AppStateService.instance.allTransactions))

      this.localStorage.saveData("liabilities", JSON.stringify(AppStateService.instance.liabilities))
      this.localStorage.saveData("shares", JSON.stringify(AppStateService.instance.allShares))
      this.localStorage.saveData("assets", JSON.stringify(AppStateService.instance.allAssets))
      this.localStorage.saveData("investments", JSON.stringify(AppStateService.instance.allInvestments))
      this.localStorage.saveData("grow", JSON.stringify(AppStateService.instance.allGrowProjects))
      this.closeWindow();
      AppComponent.gotoTop();
      this.router.navigate([AddComponent.url])
    }
  }

  removeFromMojo() {
    AppStateService.instance.mojo.amount += parseFloat(AddComponent.amountTextField);
  }

  addToMojo() {
    AppStateService.instance.mojo.amount -= parseFloat(AddComponent.amountTextField);
    // Log mojo update from add transaction
    this.frontendLogger.logActivity('update_mojo_from_transaction', 'info', {
      projectType: 'mojo',
      amount: parseFloat(AddComponent.amountTextField),
      newBalance: AppStateService.instance.mojo.amount,
      target: AppStateService.instance.mojo.target,
      source: 'add_transaction'
    });
  }

  returnCorrectMojo() {
    let result = parseFloat(AddComponent.amountTextField);
    if (AppStateService.instance.mojo.amount - result > AppStateService.instance.mojo.target) {
      result = AppStateService.instance.mojo.target - AppStateService.instance.mojo.amount;
      return result * -1;
    }
    return result;
  }

  /**
   * Smart allocation: Distribute amount across buckets with intelligent overflow handling
   * - Tries to distribute evenly across buckets with remaining capacity
   * - If a bucket would overflow, caps it at 100% and redistributes leftover to other buckets
   * - If all buckets fill before amount is fully distributed, adjusts transaction amount
   * Returns { allocations, adjustedAmount }
   */
  distributeAmountToBuckets(buckets: any[], transactionAmount: number): { 
    allocations: Array<{bucketName: string, amount: number}>,
    adjustedAmount?: number 
  } {
    const amountToDistribute = Math.abs(transactionAmount);
    const allocations: Array<{bucketName: string, amount: number}> = [];
    
    // Calculate remaining capacity for each bucket
    const bucketInfo = buckets.map(bucket => ({
      bucket,
      remaining: Math.max(0, bucket.target - bucket.amount),
      allocated: 0
    }));
    
    let remainingToDistribute = amountToDistribute;
    let activeBuckets = bucketInfo.filter(b => b.remaining > 0);
    
    // If no buckets have space, still distribute equally (overflow scenario)
    if (activeBuckets.length === 0) {
      const perBucket = amountToDistribute / buckets.length;
      buckets.forEach(bucket => {
        allocations.push({
          bucketName: bucket.title,
          amount: perBucket
        });
      });
      return { allocations };
    }
    
    // Iterative smart allocation
    while (remainingToDistribute > 0.01 && activeBuckets.length > 0) {
      // Try to distribute evenly across active buckets
      const perBucket = remainingToDistribute / activeBuckets.length;
      
      let overflow = 0;
      const bucketsToRemove: any[] = [];
      
      // Check each active bucket
      activeBuckets.forEach(info => {
        if (perBucket <= info.remaining + 0.01) { // Small epsilon for rounding
          // Bucket can take this amount
          info.allocated += perBucket;
          info.remaining -= perBucket;
        } else {
          // Bucket would overflow - cap at remaining capacity
          overflow += (perBucket - info.remaining);
          info.allocated += info.remaining;
          info.remaining = 0;
          bucketsToRemove.push(info);
        }
      });
      
      // Round all allocations to 2 decimal places
      activeBuckets.forEach(info => {
        info.allocated = Math.round(info.allocated * 100) / 100;
      });
      bucketsToRemove.forEach(info => {
        info.allocated = Math.round(info.allocated * 100) / 100;
      });
      
      // Remove filled buckets from active list
      activeBuckets = activeBuckets.filter(b => !bucketsToRemove.includes(b));
      
      // Update remaining amount to redistribute
      remainingToDistribute = overflow;
    }
    
    // Build allocations array with rounded amounts
    bucketInfo.forEach(info => {
      if (info.allocated > 0.01) { // Ignore negligible amounts
        allocations.push({
          bucketName: info.bucket.title,
          amount: Math.round(info.allocated * 100) / 100
        });
      }
    });
    
    // Check if we need to adjust transaction amount
    let adjustedAmount: number | undefined;
    if (remainingToDistribute > 0.01 && activeBuckets.length === 0) {
      // All buckets are full but we still have leftover
      // Adjust transaction to exactly what was needed
      const totalAllocated = bucketInfo.reduce((sum, info) => sum + info.allocated, 0);
      adjustedAmount = transactionAmount < 0 ? -totalAllocated : totalAllocated;
    }
    
    return { allocations, adjustedAmount };
  }

  /**
   * Parses manual bucket allocations from comment and validates they sum to the transaction amount.
   * Returns the allocations if valid, null otherwise.
   * 
   * @param comment - Transaction comment that may contain manual bucket tags
   * @param transactionAmount - The actual transaction amount to validate against
   * @param projectBuckets - Array of bucket objects to validate bucket names
   * @returns Array of allocations if valid, null if invalid or not present
   */
  parseManualBucketAllocations(comment: string | undefined, transactionAmount: number, projectBuckets: any[]): Array<{bucketName: string, amount: number}> | null {
    if (!comment) return null;
    
    // Find all bucket tags in comment
    const bucketTagMatches = comment.match(/#bucket:([^:]+):([\d.]+)/g);
    if (!bucketTagMatches || bucketTagMatches.length === 0) return null;
    
    // Parse allocations
    const allocations: Array<{bucketName: string, amount: number}> = [];
    let totalAllocated = 0;
    
    for (const tag of bucketTagMatches) {
      const match = tag.match(/#bucket:([^:]+):([\d.]+)/);
      if (!match) continue;
      
      const bucketName = match[1];
      const amount = parseFloat(match[2]);
      
      // Validate bucket exists in project
      const bucketExists = projectBuckets.some(b => b.title === bucketName);
      if (!bucketExists) return null; // Invalid bucket name
      
      allocations.push({ bucketName, amount });
      totalAllocated += amount;
    }
    
    // Validate total matches transaction amount (with 0.01 tolerance for rounding)
    const expectedAmount = Math.abs(transactionAmount);
    if (Math.abs(totalAllocated - expectedAmount) > 0.01) {
      return null; // Manual allocations don't add up to transaction amount
    }
    
    return allocations;
  }

  addToSmileProject(category: string) {
    for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
      if (category === ("@" + AppStateService.instance.allSmileProjects[i].title)) {
        const project = AppStateService.instance.allSmileProjects[i];
        let amount = parseFloat(AddComponent.amountTextField);
        
        // First, try to parse manual bucket allocations from comment
        const manualAllocations = this.parseManualBucketAllocations(
          AddComponent.commentTextField, 
          amount, 
          project.buckets || []
        );
        
        let usedAllocations: Array<{bucketName: string, amount: number}> | null = null;
        let needsCommentUpdate = false;
        
        if (manualAllocations) {
          // User manually specified valid allocations that add up
          // Cap each allocation at bucket capacity (NO overflow redistribution)
          const cappedAllocations: Array<{bucketName: string, amount: number}> = [];
          
          manualAllocations.forEach(allocation => {
            const bucket = project.buckets.find(b => b.title === allocation.bucketName);
            if (bucket) {
              // Calculate remaining capacity
              const remaining = Math.max(0, bucket.target - bucket.amount);
              const cappedAmount = Math.min(allocation.amount, remaining);
              
              // Update bucket with capped amount
              bucket.amount = Math.round((bucket.amount + cappedAmount) * 100) / 100;
              
              if (cappedAmount > 0) {
                cappedAllocations.push({
                  bucketName: allocation.bucketName,
                  amount: cappedAmount
                });
              }
              
              // Mark if we had to cap
              if (cappedAmount < allocation.amount) {
                needsCommentUpdate = true;
                console.warn(
                  `Bucket '${bucket.title}' capped at target: ` +
                  `requested ${allocation.amount}, applied ${cappedAmount}`
                );
              }
            }
          });
          
          usedAllocations = cappedAllocations;
          
          // Adjust transaction amount to match what actually fit in the bucket(s)
          const totalCapped = cappedAllocations.reduce((sum, a) => sum + a.amount, 0);
          if (totalCapped !== Math.abs(amount)) {
            amount = amount < 0 ? -totalCapped : totalCapped;
            // Update the text field to show adjusted amount
            AddComponent.amountTextField = amount.toString();
            
            // Update comment to reflect capped amounts
            let cleanComment = AddComponent.commentTextField || '';
            const oldTags = cleanComment.match(/#bucket:([^:]+):([\d.]+)/g);
            if (oldTags) {
              oldTags.forEach(tag => {
                cleanComment = cleanComment.replace(tag, '').trim();
              });
            }
            const newTags = cappedAllocations
              .filter(a => a.amount > 0)
              .map(a => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
              .join(' ');
            AddComponent.commentTextField = cleanComment
              ? `${cleanComment} ${newTags}`.trim()
              : newTags;
            
            needsCommentUpdate = true;
            console.log(`Transaction amount adjusted to ${amount} to match capped allocations`);
          }
          
          // Always update comment if we had to cap or redistribute
          if (cappedAllocations.length !== manualAllocations.length) {
            needsCommentUpdate = true;
          }
        } else if (project.buckets?.length > 0) {
          // No valid manual allocations - use smart allocation algorithm
          const result = this.distributeAmountToBuckets(project.buckets, amount);
          const { allocations } = result;
          usedAllocations = allocations;
          
          // Update bucket amounts with rounding to 2 decimal places
          allocations.forEach(allocation => {
            const bucket = project.buckets.find(b => b.title === allocation.bucketName);
            if (bucket) {
              bucket.amount = Math.round((bucket.amount + allocation.amount) * 100) / 100;
            }
          });
          
          // Smart allocation always needs comment update to show distribution
          needsCommentUpdate = true;
        }
        
        // Store whether comment needs updating for later use in updateTransactionWithAllocationTags
        (project as any)._needsCommentUpdate = needsCommentUpdate;
        (project as any)._cappedAllocations = usedAllocations;
        
        // Log smile project update from add transaction
        this.frontendLogger.logActivity('update_smile_project_from_transaction', 'info', {
          projectType: 'smile',
          projectTitle: project.title,
          amount: amount,
          buckets: usedAllocations?.map(a => ({name: a.bucketName, amount: a.amount})),
          category: category,
          source: 'add_transaction'
        });
      }
    }
  }

  addToFireEmergencie(category: string) {
    for (let i = 0; i < AppStateService.instance.allFireEmergencies.length; i++) {
      if (category === ("@" + AppStateService.instance.allFireEmergencies[i].title)) {
        const emergency = AppStateService.instance.allFireEmergencies[i];
        let amount = parseFloat(AddComponent.amountTextField);
        
        // First, try to parse manual bucket allocations from comment
        const manualAllocations = this.parseManualBucketAllocations(
          AddComponent.commentTextField, 
          amount, 
          emergency.buckets || []
        );
        
        let usedAllocations: Array<{bucketName: string, amount: number}> | null = null;
        let needsCommentUpdate = false;
        
        if (manualAllocations) {
          // User manually specified valid allocations that add up
          // Cap each allocation at bucket capacity (NO overflow redistribution)
          const cappedAllocations: Array<{bucketName: string, amount: number}> = [];
          
          manualAllocations.forEach(allocation => {
            const bucket = emergency.buckets.find(b => b.title === allocation.bucketName);
            if (bucket) {
              // Calculate remaining capacity
              const remaining = Math.max(0, bucket.target - bucket.amount);
              const cappedAmount = Math.min(allocation.amount, remaining);
              
              // Update bucket with capped amount
              bucket.amount = Math.round((bucket.amount + cappedAmount) * 100) / 100;
              
              if (cappedAmount > 0) {
                cappedAllocations.push({
                  bucketName: allocation.bucketName,
                  amount: cappedAmount
                });
              }
              
              // Mark if we had to cap
              if (cappedAmount < allocation.amount) {
                needsCommentUpdate = true;
                console.warn(
                  `Bucket '${bucket.title}' capped at target: ` +
                  `requested ${allocation.amount}, applied ${cappedAmount}`
                );
              }
            }
          });
          
          usedAllocations = cappedAllocations;
          
          // Adjust transaction amount to match what actually fit in the bucket(s)
          const totalCapped = cappedAllocations.reduce((sum, a) => sum + a.amount, 0);
          if (totalCapped !== Math.abs(amount)) {
            amount = amount < 0 ? -totalCapped : totalCapped;
            // Update the text field to show adjusted amount
            AddComponent.amountTextField = amount.toString();
            
            // Update comment to reflect capped amounts
            let cleanComment = AddComponent.commentTextField || '';
            const oldTags = cleanComment.match(/#bucket:([^:]+):([\d.]+)/g);
            if (oldTags) {
              oldTags.forEach(tag => {
                cleanComment = cleanComment.replace(tag, '').trim();
              });
            }
            const newTags = cappedAllocations
              .filter(a => a.amount > 0)
              .map(a => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
              .join(' ');
            AddComponent.commentTextField = cleanComment
              ? `${cleanComment} ${newTags}`.trim()
              : newTags;
            
            needsCommentUpdate = true;
            console.log(`Transaction amount adjusted to ${amount} to match capped allocations`);
          }
          
          // Always update comment if we had to cap or redistribute
          if (cappedAllocations.length !== manualAllocations.length) {
            needsCommentUpdate = true;
          }
        } else if (emergency.buckets?.length > 0) {
          // No valid manual allocations - use smart allocation algorithm
          const result = this.distributeAmountToBuckets(emergency.buckets, amount);
          const { allocations } = result;
          usedAllocations = allocations;
          
          // Update bucket amounts with rounding to 2 decimal places
          allocations.forEach(allocation => {
            const bucket = emergency.buckets.find(b => b.title === allocation.bucketName);
            if (bucket) {
              bucket.amount = Math.round((bucket.amount + allocation.amount) * 100) / 100;
            }
          });
          
          // Smart allocation always needs comment update to show distribution
          needsCommentUpdate = true;
        }
        
        // Store whether comment needs updating for later use in updateTransactionWithAllocationTags
        (emergency as any)._needsCommentUpdate = needsCommentUpdate;
        (emergency as any)._cappedAllocations = usedAllocations;
        
        // Log fire emergency update from add transaction
        this.frontendLogger.logActivity('update_fire_emergency_from_transaction', 'info', {
          projectType: 'fire',
          projectTitle: emergency.title,
          amount: amount,
          buckets: usedAllocations?.map(a => ({name: a.bucketName, amount: a.amount})),
          category: category,
          source: 'add_transaction'
        });
      }
    }
  }

  /**
   * Updates transaction with bucket allocation tags after it has been added to the array.
   * This must be called AFTER the transaction is pushed to AppStateService.instance.allTransactions
   * so we can properly access and modify it.
   */
  updateTransactionWithAllocationTags(transaction: Transaction, category: string) {
    // Check if transaction is for a Smile project
    for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
      if (category === ("@" + AppStateService.instance.allSmileProjects[i].title)) {
        const project = AppStateService.instance.allSmileProjects[i];
        
        // Check if we have capped allocations from addToSmileProject that need comment update
        const hadCappedAllocations = (project as any)._cappedAllocations !== undefined;
        
        if ((project as any)._needsCommentUpdate && (project as any)._cappedAllocations) {
          const cappedAllocations = (project as any)._cappedAllocations;
          
          // Remove old bucket tags from comment
          let cleanComment = transaction.comment || '';
          const oldTags = cleanComment.match(/#bucket:([^:]+):([\d.]+)/g);
          if (oldTags) {
            oldTags.forEach(tag => {
              cleanComment = cleanComment.replace(tag, '').trim();
            });
          }
          
          // Add new tags with capped amounts
          const newTags = cappedAllocations
            .filter((a: any) => a.amount > 0)
            .map((a: any) => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
            .join(' ');
          
          transaction.comment = cleanComment
            ? `${cleanComment}\n${newTags}`
            : newTags;
          
          // Update transaction amount to match total capped amount
          const totalCapped = cappedAllocations.reduce((sum: number, a: any) => sum + a.amount, 0);
          transaction.amount = transaction.amount < 0 ? -totalCapped : totalCapped;
        }
        
        // Clean up temporary properties
        delete (project as any)._needsCommentUpdate;
        delete (project as any)._cappedAllocations;
        
        // If we already handled capped allocations (manual or not), we're done
        if (hadCappedAllocations) {
          break;
        }
        
        // Check if there are valid manual bucket allocations in the comment
        const manualAllocations = this.parseManualBucketAllocations(
          transaction.comment,
          transaction.amount,
          project.buckets || []
        );
        
        // Keep manual allocations if valid, otherwise add smart allocation tags
        if (!manualAllocations && project.buckets?.length > 0) {
          // No valid manual tags - use smart allocation algorithm
          const result = this.distributeAmountToBuckets(project.buckets, transaction.amount);
          const { allocations, adjustedAmount } = result;
          
          // If transaction amount was adjusted (all buckets filled), update it
          if (adjustedAmount !== undefined) {
            transaction.amount = adjustedAmount;
            
            // Log the adjustment
            this.frontendLogger.logActivity('adjust_transaction_amount', 'info', {
              projectType: 'smile',
              projectTitle: project.title,
              originalAmount: transaction.amount,
              adjustedAmount: adjustedAmount,
              reason: 'all_buckets_filled'
            });
          }
          
          // Remove any existing invalid bucket tags from comment first
          let cleanComment = transaction.comment || '';
          const oldTags = cleanComment.match(/#bucket:([^:]+):([\d.]+)/g);
          if (oldTags) {
            oldTags.forEach(tag => {
              cleanComment = cleanComment.replace(tag, '').trim();
            });
          }
          
          // Create new allocation tags
          const allocationTags = allocations
            .map(a => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
            .join(' ');
          
          // Append to cleaned comment
          transaction.comment = cleanComment
            ? `${cleanComment}\n${allocationTags}`
            : allocationTags;
        }
        break;
      }
    }

    // Check if transaction is for a Fire emergency
    for (let i = 0; i < AppStateService.instance.allFireEmergencies.length; i++) {
      if (category === ("@" + AppStateService.instance.allFireEmergencies[i].title)) {
        const emergency = AppStateService.instance.allFireEmergencies[i];
        
        // Check if we have capped allocations from addToFireEmergencie that need comment update
        const hadCappedAllocations = (emergency as any)._cappedAllocations !== undefined;
        
        if ((emergency as any)._needsCommentUpdate && (emergency as any)._cappedAllocations) {
          const cappedAllocations = (emergency as any)._cappedAllocations;
          
          // Remove old bucket tags from comment
          let cleanComment = transaction.comment || '';
          const oldTags = cleanComment.match(/#bucket:([^:]+):([\d.]+)/g);
          if (oldTags) {
            oldTags.forEach(tag => {
              cleanComment = cleanComment.replace(tag, '').trim();
            });
          }
          
          // Add new tags with capped amounts
          const newTags = cappedAllocations
            .filter((a: any) => a.amount > 0)
            .map((a: any) => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
            .join(' ');
          
          transaction.comment = cleanComment
            ? `${cleanComment}\n${newTags}`
            : newTags;
          
          // Update transaction amount to match total capped amount
          const totalCapped = cappedAllocations.reduce((sum: number, a: any) => sum + a.amount, 0);
          transaction.amount = transaction.amount < 0 ? -totalCapped : totalCapped;
        }
        
        // Clean up temporary properties
        delete (emergency as any)._needsCommentUpdate;
        delete (emergency as any)._cappedAllocations;
        
        // If we already handled capped allocations (manual or not), we're done
        if (hadCappedAllocations) {
          break;
        }
        
        // Check if there are valid manual bucket allocations in the comment
        const manualAllocations = this.parseManualBucketAllocations(
          transaction.comment,
          transaction.amount,
          emergency.buckets || []
        );
        
        // Keep manual allocations if valid, otherwise add smart allocation tags
        if (!manualAllocations && emergency.buckets?.length > 0) {
          // No valid manual tags - use smart allocation algorithm
          const result = this.distributeAmountToBuckets(emergency.buckets, transaction.amount);
          const { allocations, adjustedAmount } = result;
          
          // If transaction amount was adjusted (all buckets filled), update it
          if (adjustedAmount !== undefined) {
            transaction.amount = adjustedAmount;
            
            // Log the adjustment
            this.frontendLogger.logActivity('adjust_transaction_amount', 'info', {
              projectType: 'fire',
              projectTitle: emergency.title,
              originalAmount: transaction.amount,
              adjustedAmount: adjustedAmount,
              reason: 'all_buckets_filled'
            });
          }
          
          // Remove any existing invalid bucket tags from comment first
          let cleanComment = transaction.comment || '';
          const oldTags = cleanComment.match(/#bucket:([^:]+):([\d.]+)/g);
          if (oldTags) {
            oldTags.forEach(tag => {
              cleanComment = cleanComment.replace(tag, '').trim();
            });
          }
          
          // Create new allocation tags
          const allocationTags = allocations
            .map(a => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
            .join(' ');
          
          // Append to cleaned comment
          transaction.comment = cleanComment
            ? `${cleanComment}\n${allocationTags}`
            : allocationTags;
        }
        break;
      }
    }
  }

  returnCorrectSmileAmount() {
    let result = parseFloat(AddComponent.amountTextField);
    for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
      if ("@" + AppStateService.instance.allSmileProjects[i].title === AddComponent.categoryTextField) {
        const project = AppStateService.instance.allSmileProjects[i];
        const totalTarget = project.buckets.reduce((sum, b) => sum + (b.target || 0), 0);
        const totalAmount = project.buckets.reduce((sum, b) => sum + (b.amount || 0), 0);
        
        if (totalAmount - result > totalTarget) {
          result = totalTarget - totalAmount;
          return result * -1;
        }
      }
    }
    return result;
  }

  returnCorrectFireAmount() {
    // Fire no longer has target capping - bucket-based system allows flexible allocations
    // Return the entered amount as-is; bucket targets are informational only
    return parseFloat(AddComponent.amountTextField);
  }

}
