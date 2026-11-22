import { Injectable, signal } from '@angular/core';

export type ConfirmDialogTone = 'primary' | 'success' | 'danger' | 'warning';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  icon?: string;
}

export interface ActiveConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmDialogTone;
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly activeState = signal<ActiveConfirmState | null>(null);
  private resolver: ((confirmed: boolean) => void) | null = null;

  readonly state = this.activeState.asReadonly();

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    if (this.resolver) {
      this.resolver(false);
      this.resolver = null;
    }

    const tone = options.tone ?? 'primary';
    const defaultIcon =
      tone === 'danger'
        ? 'warning'
        : tone === 'success'
          ? 'check_circle'
          : tone === 'warning'
            ? 'help_outline'
            : 'task_alt';

    this.activeState.set({
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirm',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      tone,
      icon: options.icon ?? defaultIcon,
    });

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  decide(confirmed: boolean): void {
    const res = this.resolver;
    this.resolver = null;
    this.activeState.set(null);
    if (res) {
      res(confirmed);
    }
  }
}
