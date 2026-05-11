import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app).toBeTruthy();
  });

  it('should render the calculator headline', async () => {
    const fixture = TestBed.createComponent(App);

    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Fairer Pensionssplitting-Rechner'
    );
  });

  it('should calculate the fair transfer amount across multiple years', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.birthYearControl.setValue(app.currentYear - 1);
    app.yearsControl.setValue(2);
    app.entries.at(0).patchValue({ transferor: 100, recipient: 20 });
    app.entries.at(1).patchValue({ transferor: 50, recipient: 10 });

    fixture.detectChanges();

    const summary = app.summary;

    expect(app.allowedMaxYears).toBe(2);
    expect(app.yearResults[0].transferAmount).toBe(40);
    expect(summary).not.toBeNull();
    expect(summary?.transferAmount).toBe(60);
  });

  it('should default to the maximum selectable years after entering the birth year initially', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.birthYearControl.setValue(app.currentYear - 7);
    fixture.detectChanges();

    const slider = fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;

    expect(app.allowedMaxYears).toBe(8);
    expect(app.yearsControl.value).toBe(8);
    expect(app.entries.length).toBe(8);
    expect(slider.value).toBe('8');
  });

  it('should not calculate a summary while yearly inputs are incomplete', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.birthYearControl.setValue(app.currentYear - 1);
    app.yearsControl.setValue(2);
    app.entries.at(0).patchValue({ transferor: 100, recipient: 20 });
    app.entries.at(1).patchValue({ transferor: null, recipient: 10 });

    fixture.detectChanges();

    expect(app.hasIncompleteEntries).toBe(true);
    expect(app.yearResults[1].isComplete).toBe(false);
    expect(app.summary).toBeNull();
  });

  it('should clamp the selectable years to the valid maximum for the birth year', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.birthYearControl.setValue(app.currentYear);
    app.yearsControl.setValue(8);

    fixture.detectChanges();

    expect(app.allowedMaxYears).toBe(1);
    expect(app.yearsControl.value).toBe(1);
    expect(app.entries.length).toBe(1);
  });

  it('should preserve entered yearly values while the birth year is temporarily invalid', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.birthYearControl.setValue(app.currentYear - 2);
    app.yearsControl.setValue(3);
    app.entries.at(0).patchValue({ transferor: 100, recipient: 20 });
    app.entries.at(1).patchValue({ transferor: 90, recipient: 25 });
    app.entries.at(2).patchValue({ transferor: 80, recipient: 30 });

    app.birthYearControl.setValue(null);
    fixture.detectChanges();

    expect(app.entries.length).toBe(3);
    expect(app.entries.at(1).value).toEqual({ transferor: 90, recipient: 25 });

    app.birthYearControl.setValue(app.currentYear - 2);
    fixture.detectChanges();

    expect(app.entries.length).toBe(3);
    expect(app.entries.at(2).value).toEqual({ transferor: 80, recipient: 30 });
  });
});
