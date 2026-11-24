import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Banner } from './banner';

describe('Portada de TalentMatch', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: Banner }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  it('presenta el acceso y el enlace público a vacantes', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const portada = harness.routeNativeElement!;
    expect(portada.querySelector('h1')?.textContent).toContain('TalentMatch');
    expect(portada.querySelector('a.empezar')?.getAttribute('href')).toBe('/?acceso=1');
    expect(portada.querySelector('a.explorar')?.getAttribute('href')).toBe('/vacantes');
    expect(portada.querySelector('.panel-acceso')?.hasAttribute('inert')).toBe(true);
  });

  it('mantiene la fotografía al entrar y al volver con la flecha', async () => {
    const harness = await RouterTestingHarness.create('/');
    const portada = harness.routeNativeElement!;
    const foto = portada.querySelector('.fotografia');
    await harness.navigateByUrl('/?acceso=1');
    await harness.fixture.whenStable();
    expect(portada.querySelector('.escenario')?.classList.contains('acceso-abierto')).toBe(true);
    expect(portada.querySelector('.fotografia')).toBe(foto);
    expect(portada.querySelector('.panel-acceso')?.hasAttribute('inert')).toBe(false);
    portada.querySelector<HTMLAnchorElement>('.volver')!.click();
    await harness.fixture.whenStable();
    expect(portada.querySelector('.escenario')?.classList.contains('acceso-abierto')).toBe(false);
    expect(portada.querySelector('.fotografia')).toBe(foto);
  });
});
