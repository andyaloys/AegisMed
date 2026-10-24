import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'primary';

export interface ToastItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
}

export interface DialogOptions {
  title: string;
  message: string;
  type?: NotificationType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  icon?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private toastsSubject = new BehaviorSubject<ToastItem[]>([]);
  public toasts$: Observable<ToastItem[]> = this.toastsSubject.asObservable();

  private activeDialogSubject = new BehaviorSubject<{
    options: DialogOptions;
    resolve: (value: boolean) => void;
  } | null>(null);
  public activeDialog$ = this.activeDialogSubject.asObservable();

  // ==================== TOAST NOTIFICATIONS ====================

  public showToast(message: string, type: NotificationType = 'info', title?: string, duration: number = 4000): void {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const item: ToastItem = { id, type, title, message, duration };
    
    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, item]);

    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, duration);
    }
  }

  public success(message: string, title: string = 'Berhasil'): void {
    this.showToast(message, 'success', title);
  }

  public error(message: string, title: string = 'Terjadi Kesalahan'): void {
    this.showToast(message, 'error', title, 6000);
  }

  public warning(message: string, title: string = 'Peringatan'): void {
    this.showToast(message, 'warning', title, 5000);
  }

  public info(message: string, title: string = 'Informasi'): void {
    this.showToast(message, 'info', title);
  }

  public removeToast(id: string): void {
    const updated = this.toastsSubject.value.filter(t => t.id !== id);
    this.toastsSubject.next(updated);
  }

  // ==================== CUSTOM MODAL DIALOGS ====================

  /**
   * Tampilkan Modal Konfirmasi interaktif (menggantikan browser confirm)
   * Resolves ke boolean: true jika user menekan tombol konfirmasi, false jika batal/tutup
   */
  public confirm(options: DialogOptions | string): Promise<boolean> {
    const config: DialogOptions = typeof options === 'string'
      ? { title: 'Konfirmasi Tindakan', message: options, showCancel: true, confirmText: 'Ya, Lanjutkan', cancelText: 'Batal', type: 'warning' }
      : {
          title: options.title || 'Konfirmasi Tindakan',
          message: options.message,
          type: options.type || 'warning',
          confirmText: options.confirmText || 'Ya, Lanjutkan',
          cancelText: options.cancelText || 'Batal',
          showCancel: options.showCancel !== false,
          icon: options.icon
        };

    return new Promise<boolean>((resolve) => {
      this.activeDialogSubject.next({
        options: config,
        resolve: (result: boolean) => {
          this.activeDialogSubject.next(null);
          resolve(result);
        }
      });
    });
  }

  /**
   * Tampilkan Modal Alert interaktif (menggantikan browser alert)
   * Resolves setelah user menekan 'Tutup' / 'Mengerti'
   */
  public alert(titleOrMessage: string, message?: string, type: NotificationType = 'info'): Promise<void> {
    const title = message ? titleOrMessage : (type === 'error' ? 'Perhatian' : (type === 'success' ? 'Berhasil' : 'Informasi'));
    const body = message ? message : titleOrMessage;

    return new Promise<void>((resolve) => {
      this.activeDialogSubject.next({
        options: {
          title,
          message: body,
          type,
          showCancel: false,
          confirmText: 'Mengerti'
        },
        resolve: () => {
          this.activeDialogSubject.next(null);
          resolve();
        }
      });
    });
  }

  public closeDialog(result: boolean): void {
    const active = this.activeDialogSubject.value;
    if (active) {
      active.resolve(result);
    }
  }
}
