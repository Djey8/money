import { Component } from '@angular/core'
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ProfileComponent } from '../panels/profile/profile.component';
import { AppComponent } from '../app.component';
import { LocalService } from '../shared/services/local.service';
import { DatabaseService } from '../shared/services/database.service';
import { Profile } from '../interfaces/profile';
import { SmileProjectsComponent } from '../main/smile/smile-projects/smile-projects.component';
import { CrypticService } from '../shared/services/cryptic.service';
import { SelfhostedService } from '../shared/services/selfhosted.service';
import { FrontendLoggerService } from '../shared/services/frontend-logger.service';
import { ErrorMapperService } from '../shared/services/error-mapper.service';
import { environment } from '../../environments/environment';
import { from, of, concat } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { AppStateService } from '../shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Represents the Registration Component.
 */
@Injectable({
  providedIn:'root',
})
@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css', '../app.component.css'],
})
export class RegistrationComponent { 
  //Variables
  isRegister = false;

  isError = false;
  errorMessageLable = "Error";

  //Textfield Variables
  usernameTextField = '';
  emailTextField = '';
  passwordTextField = '';

  eyePic = "../../assets/symbols/eye.png";
  showPassword = false;

  isUploaded = false;
  filename = "";
  
  public get appReference() { return AppComponent; }
  private mode: 'firebase' | 'selfhosted' = environment.mode as 'firebase' | 'selfhosted';

  /**
   * Constructs a new instance of the RegistrationComponent class.
   * @param afAuth - The AngularFireAuth instance used for authentication.
   * @param localStorage - The LocalService instance used for accessing local storage.
   * @param database - The DatabaseService instance used for accessing the database.
   * @param selfhosted - The SelfhostedService instance for selfhosted authentication.
   * @param frontendLogger - The FrontendLoggerService instance for logging user activities.
   */
  constructor(
    public afAuth: AngularFireAuth, 
    private localStorage: LocalService, 
    private database: DatabaseService, 
    private cryptic: CrypticService,
    private selfhosted: SelfhostedService,
    private frontendLogger: FrontendLoggerService,
    private errorMapper: ErrorMapperService
  ){
    //delete storage when loaded to then set from db
    this.localStorage.removeData("transactions");
    this.localStorage.removeData("smile");
    this.localStorage.removeData("fire");
    this.localStorage.removeData("mojo");
    this.localStorage.removeData("username");
    this.localStorage.removeData("uid");
    this.localStorage.removeData("email");
    AppStateService.instance.allTransactions = [];
    AppStateService.instance.allSmileProjects = [];
  }

  /**
   * Called when the component becomes visible (inserted into the DOM).
   */
  ngOnInit(): void {
  }

  /**
   * Called when the component is destroyed (removed from the DOM).
   */
  ngOnDestroy(): void {
  }


  upload(){
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            const settings = JSON.parse(e.target.result);
            if (settings.key && settings.local && settings.database) {
              this.cryptic.updateConfig(settings.key, settings.local, settings.database);
              this.isUploaded = true;
              this.filename = file.name;
            } else {
              this.isError = true;
              this.errorMessageLable = 'Invalid settings file';
            }
          } catch (error) {
            this.isError = true;
            this.errorMessageLable = 'Error parsing settings file';
          }
        };
        reader.readAsText(file);
      }
    };
    fileInput.click();
  }

  default() {
    this.cryptic.updateConfig('default', true, false);
    this.isUploaded = false;
  }

  /**
   * Signs up a new user with the provided email and password.
   * @param email - The email of the user.
   * @param password - The password of the user.
   * @returns A promise that resolves when the user is registered successfully.
   */
  SignUp(email:string,password:string){
    if (this.mode === 'selfhosted') {
      // Selfhosted mode - use backend API
      return this.selfhosted.register(this.emailTextField, this.passwordTextField, this.usernameTextField)
        .toPromise()
        .then((result) => {
          // Log successful registration
          this.frontendLogger.logAuth('register', true, {
            username: this.usernameTextField,
            email: this.emailTextField,
            mode: 'selfhosted'
          });
          
          this.localStorage.removeData("transactions");
          this.localStorage.removeData("smile");
          this.localStorage.removeData("fire");
          
          this.localStorage.saveData("username", this.usernameTextField);
          this.localStorage.saveData("uid", result.userId);
          this.localStorage.saveData("email", this.emailTextField);
          
          // Write initial data structure to user's hierarchical JSON document sequentially
          // All data is stored in a single document with nested paths
          // MUST be sequential to avoid CouchDB revision conflicts
          
          // Helper function that wraps writeObject to always return an Observable
          const writeObservable = (tag: string, data: any) => {
            const result = this.database.writeObject(tag, data);
            // If selfhosted mode, returns Observable; if Firebase, returns void
            return result || of(null);
          };

          // Define all writes to be executed sequentially
          const writes = [
            { tag: "info/username", data: this.usernameTextField },
            { tag: "info/email", data: this.emailTextField },
            { tag: "transactions", data: [] },
            { tag: "smile", data: [] },
            { tag: "fire", data: [] },
            { tag: "mojo", data: { target: 2000.0, amount: 0 } }
          ];

          // Execute writes sequentially using concatMap
          from(writes).pipe(
            concatMap(write => writeObservable(write.tag, write.data))
          ).subscribe({
            next: () => {
              // Each write completes
            },
            error: (error) => {
              console.error("Error writing initial data:", error);
              this.isError = true;
              this.errorMessageLable = "Failed to initialize user data";
            },
            complete: () => {
              ProfileComponent.username = this.usernameTextField;
              ProfileComponent.mail = this.emailTextField;
              ProfileComponent.isUser = true;
              
              // Trigger onboarding tour for new user
              localStorage.setItem('onboarding_pending', 'true');
              // Redirect only after all writes are complete
              window.location.href = "/";
            }
          });
        })
        .catch((error) => {
          this.isError = true;
          this.errorMessageLable = this.errorMapper.toUserMessage(error, 'Registration failed');
          console.error('Selfhosted registration error:', error);
          
          // Log failed registration
          this.frontendLogger.logAuth('register', false, {
            email: this.emailTextField,
            error: error.message || error.error?.error || 'Registration failed',
            mode: 'selfhosted'
          });
        });
    } else {
      // Firebase mode
      return this.afAuth.createUserWithEmailAndPassword(this.emailTextField, this.passwordTextField)
        .then((result) => {
          // You can redirect the user to a new page, display a success message, etc.
          this.localStorage.removeData("transactions");
          this.localStorage.removeData("smile");
          this.localStorage.removeData("fire");
          
          this.localStorage.saveData("username", this.usernameTextField);
          this.localStorage.saveData("uid", result.user.uid);
          this.localStorage.saveData("email", result.user.email);
          let profile: Profile = {
            info: {
              username: this.usernameTextField,
              email: result.user.email,
            },
            transactions: [],
            smile: [],
            fire: [],
            mojo: {
              target: 2000.0,
              amount: 0
            }
          };
          this.database.writeObject("", profile);
          ProfileComponent.username = profile.info.username;
          ProfileComponent.mail = profile.info.email;
          ProfileComponent.isUser = true;

          // Trigger onboarding tour for new user
          localStorage.setItem('onboarding_pending', 'true');
          //window.location.href = "/home";
          window.location.href = "/";
        })
        .catch((error) => {
          this.isError = true;
          this.errorMessageLable = this.errorMapper.toUserMessage(error);
          // Handle the error, display an error message, etc.
        });
    }
    }

    toggleEye(){
      this.showPassword = !this.showPassword;
    }

  /**
   * Signs in a user with the provided email and password.
   * @param email - The email of the user.
   * @param password - The password of the user.
   * @returns A promise that resolves when the user is signed in successfully.
   */
  async SignIn() {
    if (this.mode === 'selfhosted') {
      // Selfhosted mode - use backend API
      return this.selfhosted.login(this.emailTextField, this.passwordTextField)
        .toPromise()
        .then(async (result) => {
          // Log successful login
          this.frontendLogger.logAuth('login', true, {
            email: this.emailTextField,
            mode: 'selfhosted'
          });
          
          // Clear local storage
          this.localStorage.removeData("username");
          this.localStorage.removeData("mojo");
          this.localStorage.removeData("liabilities");
          this.localStorage.removeData("grow");
          this.localStorage.removeData("subscriptions");
          this.localStorage.removeData("interests");
          this.localStorage.removeData("properties");
          this.localStorage.removeData("revenues");
          this.localStorage.removeData("dailyEx");
          this.localStorage.removeData("splurgeEx");
          this.localStorage.removeData("smileEx");
          this.localStorage.removeData("fireEx");
          this.localStorage.removeData("mojoEx");
          this.localStorage.removeData("assets");
          this.localStorage.removeData("shares");
          this.localStorage.removeData("investments");
          this.localStorage.removeData("transactions");
          this.localStorage.removeData("smile");
          this.localStorage.removeData("fire");

          this.localStorage.saveData("uid", result.userId);
          this.localStorage.saveData("email", this.emailTextField);
          ProfileComponent.mail = this.emailTextField;
          
          // Get username from database - getData returns a snapshot-like object
          const profileSnapshot = await this.database.getData("info/username");
          const username = this.cryptic.decrypt(profileSnapshot.val(), 'database') || this.emailTextField; // Fallback to email if no username
          ProfileComponent.username = username;
          this.localStorage.saveData("username", username);
          ProfileComponent.isUser = false;  // false = logged in (show sign out button)
          
          window.location.href = "/";
        })
        .catch((error) => {
          // Log failed login
          this.frontendLogger.logAuth('login', false, {
            email: this.emailTextField,
            error: error.message || error.error?.error || 'Login failed',
            mode: 'selfhosted'
          });
          
          this.isError = true;
          this.errorMessageLable = this.errorMapper.toUserMessage(error, 'Login failed');
          console.error('Selfhosted login error:', error);
        });
    } else {
      // Firebase mode
      // Set Firebase Auth persistence to SESSION
      await this.afAuth.setPersistence('local')
        .catch((error) => {
          console.error("Error setting persistence: ", error);
          this.isError = true;
          this.errorMessageLable = this.errorMapper.toUserMessage(error);
        });

      return this.afAuth
        .signInWithEmailAndPassword(this.emailTextField, this.passwordTextField)
        .then((result) => {
          // Log successful login
          this.frontendLogger.logAuth('login', true, {
            email: this.emailTextField,
            mode: 'firebase'
          });
          
          this.localStorage.removeData("username");
          this.localStorage.removeData("mojo");
          this.localStorage.removeData("liabilities");
          this.localStorage.removeData("grow");
          this.localStorage.removeData("subscriptions");
          this.localStorage.removeData("interests");
          this.localStorage.removeData("properties");
          this.localStorage.removeData("revenues");
          this.localStorage.removeData("dailyEx");
          this.localStorage.removeData("splurgeEx");
          this.localStorage.removeData("smileEx");
          this.localStorage.removeData("fireEx");
          this.localStorage.removeData("mojoEx");
          this.localStorage.removeData("assets");
          this.localStorage.removeData("shares");
          this.localStorage.removeData("investments");
          this.localStorage.removeData("transactions");
          this.localStorage.removeData("smile");
          this.localStorage.removeData("fire");

          this.localStorage.saveData("uid", result.user.uid);
          this.localStorage.saveData("email", result.user.email);
          ProfileComponent.mail = result.user.email;
          this.database.getData("info/username")
            .then(snapshot => {
              let username = this.cryptic.decrypt(snapshot.val(), 'database');
              ProfileComponent.username = username;
              this.localStorage.saveData("username", username);
              ProfileComponent.isUser = false;  // false = logged in (show sign out button)
              window.location.href = "/";
            })
            .catch(_ => {
              //handle error
            });
        })
        .catch((error) => {
          // Log failed login
          this.frontendLogger.logAuth('login', false, {
            email: this.emailTextField,
            error: error.message,
            mode: 'firebase'
          });
          
          this.isError = true;
          this.errorMessageLable = this.errorMapper.toUserMessage(error, 'Login failed');
        });
    }
  }
  /**
   * Validates an email address.
   * @param email - The email address to validate.
   * @returns True if the email address is valid, false otherwise.
   */
  validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  /**
   * Registers a new user.
   * Performs error handling and validation before calling the SignUp method.
   */
  public register(): void {
    // Error Handling
    // 1. Error: check fields are empty
    if (this.emailTextField == "" || this.passwordTextField == "" || this.usernameTextField == "") {
      this.isError = true;
      this.errorMessageLable = "Please fill out all fields";
    } else if (this.passwordTextField.length<6) {
      // 2. Error: check if Password is valid (p>=6)
      this.isError = true;
      this.errorMessageLable = "Invalid password (min. 6 char)";
    } else if (!this.validateEmail(this.emailTextField)) {
      // 3. Error: check email is valid
      this.isError = true;
      this.errorMessageLable = "Invalid email format";
    } else {
      // Keine Fehler -> Try to REgister new User
      this.isError = false;
      this.errorMessageLable = "";
      this.SignUp(this.emailTextField, this.passwordTextField);
    }
  }

  /**
   * Logs in a user.
   * Performs error handling and validation before calling the SignIn method.
   */
  public login(): void {
    // Error Handling
    // 1. Error: check fields are empty
    if (this.emailTextField == "" || this.passwordTextField == "") {
      this.isError = true;
      this.errorMessageLable = "Please fill out all fields";
    } else {
      // Keine Fehler -> Try to Login User
      this.isError = false;
      this.errorMessageLable = "";
      this.SignIn();
    }  
  }
    
  public goToLogin(): void {
    this.isRegister = false;
    this.errorMessageLable = "";
    this.isError = false;
  }

  public goToRegister(): void {
    this.isRegister = true;
    this.errorMessageLable = "";
    this.isError = false;
  }

}