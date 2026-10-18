import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ProfilePictureService } from './profile-picture.selfhosted';

const PICTURE = 'data:image/jpeg;base64,/9j/4AAQ';
const wait = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ProfilePictureService (self-hosted)', () => {
  let service: ProfilePictureService;

  beforeEach(() => {
    document.body.innerHTML = '';
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfilePictureService);
  });

  afterEach(() => service.clear());

  const toolbar = () => {
    const img = document.createElement('img');
    img.id = 'profile-pic';
    img.setAttribute('src', '../assets/profile-blank.jpg');
    return img;
  };

  it('puts the picture on the toolbar image, a toolbar that appears later and back to the default on removal', async () => {
    const first = toolbar();
    document.body.appendChild(first);
    service.show(PICTURE);
    expect(first.getAttribute('src')).toBe(PICTURE);
    expect(first.classList.contains('profile-pic--custom')).toBe(true);

    const later = toolbar();
    document.body.appendChild(later);
    await wait();
    expect(later.getAttribute('src')).toBe(PICTURE);

    service.show(null);
    expect(first.getAttribute('src')).toBe('../assets/profile-blank.jpg');
    expect(first.classList.contains('profile-pic--custom')).toBe(false);
  });

  it('watches outside Angular and ignores page changes that bring no toolbar (a game board redraws all the time)', async () => {
    const outside = jest.spyOn(TestBed.inject(NgZone), 'runOutsideAngular');
    const img = toolbar();
    document.body.appendChild(img);
    service.show(PICTURE);
    expect(outside).toHaveBeenCalled();

    const set = jest.spyOn(img, 'setAttribute');
    for (let i = 0; i < 50; i += 1) {
      const board = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      document.body.appendChild(board);
      board.remove();
    }
    await wait();
    expect(set).not.toHaveBeenCalled();
  });
});
