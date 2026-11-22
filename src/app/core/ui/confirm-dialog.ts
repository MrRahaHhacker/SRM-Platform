import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmDialogService, ConfirmDialogTone } from './confirm-dialog.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-confirm-dialog',
  imports: [MatIconModule],
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (dialog(); as cfg) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/50 backdrop-blur-[1px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        tabindex="-1"
        (click)="onBackdropClick($event)"
        (keydown.escape)="cancel()"
      >
        <div class="w-full max-w-md bg-white border border-[#dce3ec] rounded-xl shadow-lg overflow-hidden">
          <div class="p-5 sm:p-6">
            <div class="flex items-start gap-3.5">
              <div
                class="w-10 h-10 rounded-lg grid place-items-center shrink-0"
                [class]="iconBoxClass(cfg.tone)"
              >
                <mat-icon class="!text-[20px] !w-5 !h-5">{{ cfg.icon }}</mat-icon>
              </div>
              <div class="min-w-0 flex-1">
                <h2 id="confirm-dialog-title" class="text-base font-bold text-[#142238] m-0 leading-snug">
                  {{ cfg.title }}
                </h2>
                <p id="confirm-dialog-message" class="text-xs text-[#475569] m-0 mt-1.5 leading-relaxed">
                  {{ cfg.message }}
                </p>
              </div>
            </div>
          </div>

          <div class="px-5 sm:px-6 py-3.5 bg-[#f8fafc] border-t border-[#e6ebf1] flex items-center justify-end gap-2.5">
            <button
              type="button"
              (click)="cancel()"
              class="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-bold text-[#334155] hover:bg-[#f1f5f9] cursor-pointer whitespace-nowrap"
            >
              {{ cfg.cancelLabel }}
            </button>
            <button
              type="button"
              (click)="accept()"
              class="h-9 px-4 rounded-lg text-xs font-bold text-white cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
              [class]="confirmButtonClass(cfg.tone)"
            >
              <mat-icon class="!text-sm !w-4 !h-4">{{ cfg.icon }}</mat-icon>
              <span>{{ cfg.confirmLabel }}</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  private readonly confirmService = inject(ConfirmDialogService);
  protected readonly dialog = this.confirmService.state;

  protected accept(): void {
    this.confirmService.decide(true);
  }

  protected cancel(): void {
    this.confirmService.decide(false);
  }

  protected onEscape(): void {
    if (this.dialog()) {
      this.cancel();
    }
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }

  protected iconBoxClass(tone: ConfirmDialogTone): string {
    switch (tone) {
      case 'danger':
        return 'bg-[#fff1f0] text-[#a13d36]';
      case 'success':
        return 'bg-[#eaf8f0] text-[#16834e]';
      case 'warning':
        return 'bg-[#fef7e6] text-[#9a6700]';
      default:
        return 'bg-[#edf3f8] text-[#183b5d]';
    }
  }

  protected confirmButtonClass(tone: ConfirmDialogTone): string {
    switch (tone) {
      case 'danger':
        return 'bg-[#a13d36] hover:bg-[#88312b]';
      case 'success':
        return 'bg-[#16834e] hover:bg-[#126a3f]';
      case 'warning':
        return 'bg-[#b45309] hover:bg-[#92400e]';
      default:
        return 'bg-[#183b5d] hover:bg-[#122e49]';
    }
  }
}
