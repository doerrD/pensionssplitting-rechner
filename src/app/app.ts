import { CurrencyPipe, registerLocaleData } from '@angular/common';
import localeDeAt from '@angular/common/locales/de-AT';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { startWith } from 'rxjs';

type YearEntryForm = FormGroup<{
  transferor: FormControl<number | null>;
  recipient: FormControl<number | null>;
}>;

interface YearResult {
  index: number;
  label: string;
  transferor: number | null;
  recipient: number | null;
  combined: number | null;
  fairShare: number | null;
  transferAmount: number | null;
  reverseGap: number | null;
  isComplete: boolean;
}

interface SummaryResult {
  totalTransferor: number;
  totalRecipient: number;
  totalCombined: number;
  fairShare: number;
  transferAmount: number;
  reverseGap: number;
}

registerLocaleData(localeDeAt);

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, CurrencyPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly formBuilder = inject(FormBuilder);

  readonly currentYear = new Date().getFullYear();
  readonly maxSupportedYears = 8;
  readonly form = this.formBuilder.group({
    birthYear: this.formBuilder.control<number | null>(null, {
      validators: [
        Validators.required,
        Validators.min(1900),
        Validators.max(this.currentYear)
      ]
    }),
    years: this.formBuilder.control(1, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(1),
        Validators.max(this.maxSupportedYears)
      ]
    }),
    entries: this.formBuilder.array<YearEntryForm>([this.createYearGroup()])
  });

  constructor() {
    this.birthYearControl.valueChanges
      .pipe(startWith(this.birthYearControl.value), takeUntilDestroyed())
      .subscribe(() => this.syncEntryCount());

    this.yearsControl.valueChanges
      .pipe(startWith(this.yearsControl.value), takeUntilDestroyed())
      .subscribe(() => this.syncEntryCount());
  }

  get birthYearControl(): FormControl<number | null> {
    return this.form.controls.birthYear;
  }

  get yearsControl(): FormControl<number> {
    return this.form.controls.years;
  }

  get entries(): FormArray<YearEntryForm> {
    return this.form.controls.entries;
  }

  get hasValidBirthYear(): boolean {
    return this.birthYearControl.valid && this.birthYearControl.value !== null;
  }

  get allowedMaxYears(): number {
    const birthYear = this.birthYearControl.value;

    if (!this.birthYearControl.valid || birthYear === null) {
      return 0;
    }

    return Math.min(this.maxSupportedYears, this.currentYear - birthYear + 1);
  }

  get yearOptions(): number[] {
    const max = this.allowedMaxYears;

    return Array.from({ length: max || 1 }, (_, index) => index + 1);
  }

  get sliderProgress(): number {
    const max = this.allowedMaxYears || 1;
    const value = Math.min(this.yearsControl.getRawValue(), max);

    if (max <= 1) {
      return 100;
    }

    return ((value - 1) / (max - 1)) * 100;
  }

  get yearResults(): YearResult[] {
    const birthYear = this.birthYearControl.value;

    return this.entries.controls
      .slice(0, this.yearsControl.getRawValue())
      .map((entryGroup, index) => {
        const transferor = this.normalizeCurrencyValue(
          entryGroup.controls.transferor.value
        );
        const recipient = this.normalizeCurrencyValue(
          entryGroup.controls.recipient.value
        );
        const isComplete =
          transferor !== null && recipient !== null && entryGroup.valid;

        if (!isComplete) {
          return {
            index,
            label:
              this.hasValidBirthYear && birthYear !== null
                ? `${birthYear + index}`
                : `Jahr ${index + 1}`,
            transferor,
            recipient,
            combined: null,
            fairShare: null,
            transferAmount: null,
            reverseGap: null,
            isComplete: false
          };
        }

        const combined = this.roundCurrency(transferor + recipient);
        const fairShare = this.roundCurrency(combined / 2);
        const difference = this.roundCurrency(transferor - fairShare);

        return {
          index,
          label:
            this.hasValidBirthYear && birthYear !== null
              ? `${birthYear + index}`
              : `Jahr ${index + 1}`,
          transferor,
          recipient,
          combined,
          fairShare,
          transferAmount: difference > 0 ? difference : 0,
          reverseGap: difference < 0 ? Math.abs(difference) : 0,
          isComplete: true
        };
      });
  }

  get hasIncompleteEntries(): boolean {
    if (!this.hasValidBirthYear) {
      return false;
    }

    return this.yearResults.some((year) => !year.isComplete);
  }

  get summary(): SummaryResult | null {
    if (!this.hasValidBirthYear || this.hasIncompleteEntries) {
      return null;
    }

    const totals = this.yearResults.reduce<SummaryResult>(
      (currentTotals, year) => ({
        totalTransferor: this.roundCurrency(
          currentTotals.totalTransferor + (year.transferor ?? 0)
        ),
        totalRecipient: this.roundCurrency(
          currentTotals.totalRecipient + (year.recipient ?? 0)
        ),
        totalCombined: this.roundCurrency(currentTotals.totalCombined + (year.combined ?? 0)),
        fairShare: 0,
        transferAmount: this.roundCurrency(
          currentTotals.transferAmount + (year.transferAmount ?? 0)
        ),
        reverseGap: this.roundCurrency(
          currentTotals.reverseGap + (year.reverseGap ?? 0)
        )
      }),
      {
        totalTransferor: 0,
        totalRecipient: 0,
        totalCombined: 0,
        fairShare: 0,
        transferAmount: 0,
        reverseGap: 0
      }
    );

    return {
      ...totals,
      fairShare: this.roundCurrency(totals.totalCombined / 2)
    };
  }

  onYearsSliderInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;

    if (target === null) {
      return;
    }

    const nextValue = Number(target.value);

    if (!Number.isFinite(nextValue)) {
      return;
    }

    this.yearsControl.markAsDirty();
    this.yearsControl.setValue(nextValue);
  }

  private createYearGroup(): YearEntryForm {
    return this.formBuilder.group({
      transferor: this.formBuilder.control<number | null>(null, {
        validators: [Validators.required, Validators.min(0)]
      }),
      recipient: this.formBuilder.control<number | null>(null, {
        validators: [Validators.required, Validators.min(0)]
      })
    });
  }

  private syncEntryCount(): void {
    if (this.hasValidBirthYear && this.yearsControl.disabled) {
      this.yearsControl.enable({ emitEvent: false });
    }

    if (!this.hasValidBirthYear && this.yearsControl.enabled) {
      this.yearsControl.disable({ emitEvent: false });
    }

    const maxYears = this.allowedMaxYears;

    if (
      maxYears > 0 &&
      this.yearsControl.pristine &&
      this.areAllEntriesEmpty() &&
      this.yearsControl.value !== maxYears
    ) {
      this.yearsControl.setValue(maxYears, { emitEvent: false });
    } else if (maxYears > 0 && this.yearsControl.value > maxYears) {
      this.yearsControl.setValue(maxYears, { emitEvent: false });
    }

    const targetLength = this.hasValidBirthYear
      ? this.yearsControl.getRawValue()
      : this.entries.length;

    while (this.entries.length < targetLength) {
      this.entries.push(this.createYearGroup());
    }

    while (this.entries.length > targetLength) {
      this.entries.removeAt(this.entries.length - 1);
    }
  }

  private normalizeCurrencyValue(value: number | null): number | null {
    return typeof value === 'number' && Number.isFinite(value)
      ? this.roundCurrency(value)
      : null;
  }

  private areAllEntriesEmpty(): boolean {
    return this.entries.controls.every(
      (entryGroup) =>
        entryGroup.controls.transferor.value === null &&
        entryGroup.controls.recipient.value === null
    );
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
