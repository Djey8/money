import { Component } from '@angular/core';
import { AppComponent } from 'src/app/app.component';
import { Router } from '@angular/router';
import { Asset } from 'src/app/interfaces/asset';
import { Share } from 'src/app/interfaces/share';
import { Investment } from 'src/app/interfaces/investment';
import { Liability } from 'src/app/interfaces/liability';
import { LocalService } from 'src/app/shared/services/local.service';
import { ChooseComponent } from 'src/app/panels/menu/choose/choose.component';
import { AddLiabilitieComponent } from 'src/app/panels/add/add-liabilitie/add-liabilitie.component';
import { AddAssetComponent } from 'src/app/panels/add/add-asset/add-asset.component';
import { AddShareComponent } from 'src/app/panels/add/add-share/add-share.component';
import { AddInvestmentComponent } from 'src/app/panels/add/add-investment/add-investment.component';
import { InfoAssetComponent } from 'src/app/panels/info/info-asset/info-asset.component';
import { InfoShareComponent } from 'src/app/panels/info/info-share/info-share.component';
import { InfoLiabilitieComponent } from 'src/app/panels/info/info-liabilitie/info-liabilitie.component';
import { InfoInvestmentComponent } from 'src/app/panels/info/info-investment/info-investment.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { IncomeComponent } from '../income/income.component';
import { AppStateService } from '../../../shared/services/app-state.service';
import { AppDataService } from '../../../shared/services/app-data.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';


/**
 * Component for displaying the balance sheet.
 */
@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppNumberPipe, InfoAssetComponent, InfoShareComponent, InfoInvestmentComponent, InfoLiabilitieComponent],
  templateUrl: './balance.component.html',
  styleUrls: ['./balance.component.css', '../../../app.component.css']
})

export class BalanceComponent {

  static get allAssets(): Asset[] { return AppStateService.instance.allAssets; }
  static set allAssets(v: Asset[]) { AppStateService.instance.allAssets = v; }
  static get allShares(): Share[] { return AppStateService.instance.allShares; }
  static set allShares(v: Share[]) { AppStateService.instance.allShares = v; }
  static get allInvestments(): Investment[] { return AppStateService.instance.allInvestments; }
  static set allInvestments(v: Investment[]) { AppStateService.instance.allInvestments = v; }

  static get liabilities(): Liability[] { return AppStateService.instance.liabilities; }
  static set liabilities(v: Liability[]) { AppStateService.instance.liabilities = v; }

  isShares = true;
  isInvestments = true;

  isLiabilities = true;
  totalAmount = 0.0

  public classReference = BalanceComponent;
  public chooseRefernce = ChooseComponent;
  public get appReference() { return AppComponent; }
  public settingsReference = SettingsComponent;
  public incomeRefference = IncomeComponent;
  public appState = AppStateService.instance;

  /**
   * Constructs a new BalanceComponent.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   */
  constructor(private router:Router, private localStorage: LocalService){ 
    AppStateService.instance.allAssets = this.localStorage.getData("assets")=="" ? [] : JSON.parse(this.localStorage.getData("assets"));
    AppStateService.instance.allShares = this.localStorage.getData("shares")=="" ? [] : JSON.parse(this.localStorage.getData("shares"));
    AppStateService.instance.allInvestments = this.localStorage.getData("investments")=="" ? [] : JSON.parse(this.localStorage.getData("investments"));

    AppStateService.instance.liabilities = this.localStorage.getData("liabilities")=="" ? [] : JSON.parse(this.localStorage.getData("liabilities"));

    this.isShares = this.localStorage.getData("isShares") == "false" ? false : true;
    this.isInvestments = this.localStorage.getData("isInvestments") == "false" ? false : true;
    this.isLiabilities = this.localStorage.getData("isLiabilities") == "false" ? false : true;

    // Tier 3: Load fresh data from server if not yet loaded
    if (AppDataService.instance && !AppStateService.instance.tier3BalanceLoaded) {
      AppDataService.instance.loadBalanceData();
    }
  }

  /**
   * Toggles the visibility of shares.
   */
  toggleShares(){
    this.isShares = !this.isShares;
    this.localStorage.saveData("isShares", this.isShares.toString());
  }

  /**
   * Toggles the visibility of investments.
   */
  toggleInvestments(){
    this.isInvestments = !this.isInvestments;
    this.localStorage.saveData("isInvestments", this.isInvestments.toString());
  }

  /**
   * Toggles the visibility of liabilities.
   */
  toggleLiabilities(){
    this.isLiabilities = !this.isLiabilities;
    this.localStorage.saveData("isLiabilities", this.isLiabilities.toString());
  }
  
  /**
   * Retrieves the total value of shares.
   * @returns The total value of shares.
   */
  static getShares(){
    let result = 0.0;
    for(let i=0; i<AppStateService.instance.allShares.length; i++){
      result += AppStateService.instance.allShares[i].quantity*AppStateService.instance.allShares[i].price;
    }
    return result;
  }

  /**
   * Retrieves the total value of investments.
   * @returns The total value of investments.
   */
  static getInvestments(){
    let result = 0.0;
    for(let i=0; i<AppStateService.instance.allInvestments.length; i++){
      result += AppStateService.instance.allInvestments[i].amount + AppStateService.instance.allInvestments[i].deposit;
    }
    return result;
  }

  /**
   * Retrieves the total value of assets.
   * @returns The total value of assets.
   */
  static getAssets(){
    let result = 0.0;
    for(let i=0; i<AppStateService.instance.allAssets.length; i++){
      result += AppStateService.instance.allAssets[i].amount;
    }
    return result;
  }

  /**
   * Retrieves the total value of liabilities.
   * @returns The total value of liabilities.
   */
  static getLiabilities(){
    let result = 0.0;
    for(let i=0; i<AppStateService.instance.liabilities.length; i++){
      result += AppStateService.instance.liabilities[i].amount + AppStateService.instance.liabilities[i].credit;
    }
    return result;
  }

  /**
   * Retrieves the total amount of assets, shares, and investments.
   * @returns The total amount of assets, shares, and investments.
   */
  static getAssetsAmount(){
    let cashflow = IncomeComponent.getTotalAmount();
    let assets = BalanceComponent.getAssets();
    let shares = BalanceComponent.getShares();
    let investments = BalanceComponent.getInvestments();
    return cashflow+assets+shares+investments;
  }

  /**
   * Retrieves the total amount of assets minus liabilities.
   * @returns The total amount of assets minus liabilities.
   */
  static getTotalAmount(){
    let assets = BalanceComponent.getAssetsAmount();
    let liabilites = BalanceComponent.getLiabilities();
    return assets-liabilites;
  }

  goToIncome() {
    this.router.navigate(['/income'])
    AppComponent.gotoTop();
  }

  goToCashflow() {
    this.router.navigate(['/cashflow']);
    AppComponent.gotoTop();
  }

  clickRow(index: number){
    AppComponent.gotoTop();
  } 

  clickRowAsset(index: number){
    AppComponent.gotoTop();
    InfoAssetComponent.setInfoAssetComponent(
      index,
      AppStateService.instance.allAssets[index].tag,
      AppStateService.instance.allAssets[index].amount,
    );
  }
  clickRowShare(index: number){
    AppComponent.gotoTop();
    InfoShareComponent.setInfoShareComponent(
      index,
      AppStateService.instance.allShares[index].tag,
      AppStateService.instance.allShares[index].quantity,
      AppStateService.instance.allShares[index].price
    );
  }
  clickRowInvestment(index: number){
    AppComponent.gotoTop();
    InfoInvestmentComponent.setInfoInvestmentComponent(
      index,
      AppStateService.instance.allInvestments[index].tag,
      AppStateService.instance.allInvestments[index].deposit,
      AppStateService.instance.allInvestments[index].amount
    );
  }
  clickRowLiabilitie(index: number){
    AppComponent.gotoTop();
    InfoLiabilitieComponent.setInfoLiabilitieComponent(
      index,
      AppStateService.instance.liabilities[index].tag,
      AppStateService.instance.liabilities[index].amount,
      AppStateService.instance.liabilities[index].credit,
      AppStateService.instance.liabilities[index].investment
    );
  }

  addAsset(){
    AppComponent.gotoTop();
    ChooseComponent.isChoose = !ChooseComponent.isChoose;
  }

  addOnlyAsset() {
    AppComponent.gotoTop();
    AddAssetComponent.isAddAsset = true;
  }

  addShare() {
    AppComponent.gotoTop();
    AddShareComponent.isAddShare = true;
  }

  addInvestment() {
    AppComponent.gotoTop();
    AddInvestmentComponent.isAddInvestment = true;
  }

  addLiabilitie(){
    AppComponent.gotoTop();
    AddLiabilitieComponent.presetInvestment = false;
    AddLiabilitieComponent.isAdd = true;
  }

  addLiabilitieAsInvestment() {
    AppComponent.gotoTop();
    AddLiabilitieComponent.presetInvestment = true;
    AddLiabilitieComponent.isAdd = true;
  }
}
