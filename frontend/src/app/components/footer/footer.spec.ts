import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Footer } from './footer';

describe('Footer', () => {
  it('enlaza a inicio y al catálogo', async () => {
    TestBed.configureTestingModule({ imports: [Footer], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Footer);
    await fixture.whenStable();
    const enlaces = (fixture.nativeElement as HTMLElement).querySelectorAll('a');
    expect([...enlaces].map((a) => a.getAttribute('href'))).toEqual(['/', '/vacantes']);
  });
});
