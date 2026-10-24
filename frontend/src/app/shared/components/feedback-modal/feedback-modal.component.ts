import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { NotificationService, ToastItem, DialogOptions } from '../../../core/services/notification.service';

@Component({
  selector: 'app-feedback-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- 1. Floating Toast Notifications Container -->
    <div class="toast-container" *ngIf="(toasts$ | async) as toasts">
      <div 
        *ngFor="let toast of toasts" 
        class="toast-card" 
        [ngClass]="'toast-' + toast.type"
        (click)="removeToast(toast.id)"
      >
        <div class="toast-icon-wrap">
          <!-- Success Icon -->
          <svg *ngIf="toast.type === 'success'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <!-- Error Icon -->
          <svg *ngIf="toast.type === 'error'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <!-- Warning Icon -->
          <svg *ngIf="toast.type === 'warning'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <!-- Info Icon -->
          <svg *ngIf="toast.type === 'info'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </div>

        <div class="toast-body">
          <div class="toast-title" *ngIf="toast.title">{{ toast.title }}</div>
          <div class="toast-message">{{ toast.message }}</div>
        </div>

        <button class="toast-close-btn" (click)="removeToast(toast.id, $event)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- 2. Centered Interactive Modal Dialog (Alert / Confirm) -->
    <div class="dialog-backdrop" *ngIf="activeDialog$ | async as dialog" (click)="onBackdropClick($event)">
      <div class="dialog-card" [ngClass]="'dialog-' + (dialog.options.type || 'info')">
        <!-- Dialog Header & Icon -->
        <div class="dialog-header">
          <div class="dialog-icon-badge" [ngClass]="'badge-' + (dialog.options.type || 'info')">
            <!-- Success Icon -->
            <svg *ngIf="dialog.options.type === 'success'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <!-- Error Icon -->
            <svg *ngIf="dialog.options.type === 'error'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <!-- Warning / Question Icon -->
            <svg *ngIf="dialog.options.type === 'warning'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <!-- Info & Primary Icon -->
            <svg *ngIf="dialog.options.type === 'info' || dialog.options.type === 'primary' || !dialog.options.type" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>

          <div class="dialog-title-block">
            <h3 class="dialog-title">{{ dialog.options.title }}</h3>
            <span class="dialog-app-tag">AegisMed Security & Quality</span>
          </div>
        </div>

        <!-- Dialog Content -->
        <div class="dialog-content">
          <p class="dialog-message">{{ dialog.options.message }}</p>
        </div>

        <!-- Dialog Action Buttons -->
        <div class="dialog-actions">
          <button 
            *ngIf="dialog.options.showCancel" 
            type="button" 
            class="btn-cancel" 
            (click)="onCancel()"
          >
            {{ dialog.options.cancelText || 'Batal' }}
          </button>
          
          <button 
            type="button" 
            class="btn-confirm" 
            [ngClass]="'btn-' + (dialog.options.type || 'primary')" 
            (click)="onConfirm()"
          >
            {{ dialog.options.confirmText || 'Ya, Lanjutkan' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ================= TOASTS CONTAINER ================= */
    .toast-container {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 440px;
      width: calc(100% - 48px);
      pointer-events: none;
    }

    .toast-card {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 18px;
      border-radius: 12px;
      background: var(--bg-card, #ffffff);
      box-shadow: 0 12px 30px -4px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08);
      border: 1px solid var(--border-color, #e2e8f0);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
    }

    .toast-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 36px -4px rgba(15, 23, 42, 0.24);
    }

    .toast-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: 5px;
    }

    .toast-success::before { background: #10b981; }
    .toast-error::before { background: #e11d48; }
    .toast-warning::before { background: #f59e0b; }
    .toast-info::before { background: #0284c7; }

    .toast-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      flex-shrink: 0;
    }

    .toast-success .toast-icon-wrap { background: rgba(16, 185, 129, 0.12); color: #10b981; }
    .toast-error .toast-icon-wrap { background: rgba(225, 29, 72, 0.12); color: #e11d48; }
    .toast-warning .toast-icon-wrap { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
    .toast-info .toast-icon-wrap { background: rgba(2, 132, 199, 0.12); color: #0284c7; }

    .toast-body {
      flex: 1;
      min-width: 0;
    }

    .toast-title {
      font-weight: 600;
      font-size: 0.92rem;
      color: var(--text-primary, #0f172a);
      margin-bottom: 2px;
    }

    .toast-message {
      font-size: 0.85rem;
      line-height: 1.4;
      color: var(--text-secondary, #475569);
      word-break: break-word;
    }

    .toast-close-btn {
      background: none;
      border: none;
      color: var(--text-muted, #94a3b8);
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      margin-top: -2px;
      margin-right: -4px;
    }

    .toast-close-btn:hover {
      color: var(--text-primary, #0f172a);
      background: rgba(15, 23, 42, 0.06);
    }

    @keyframes toastSlideIn {
      from {
        opacity: 0;
        transform: translateX(40px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    /* ================= DIALOG MODAL ================= */
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 999998;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: backdropFadeIn 0.2s ease-out;
    }

    .dialog-card {
      background: var(--bg-card, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 18px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.35);
      overflow: hidden;
      animation: dialogPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 22px 24px 16px;
    }

    .dialog-icon-badge {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .badge-success { background: rgba(16, 185, 129, 0.12); color: #10b981; }
    .badge-error { background: rgba(225, 29, 72, 0.12); color: #e11d48; }
    .badge-warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .badge-info, .badge-primary { background: rgba(2, 132, 199, 0.12); color: #0284c7; }

    .dialog-title-block {
      flex: 1;
    }

    .dialog-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary, #0f172a);
      margin: 0 0 2px 0;
      letter-spacing: -0.01em;
    }

    .dialog-app-tag {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted, #94a3b8);
    }

    .dialog-content {
      padding: 4px 24px 20px;
    }

    .dialog-message {
      font-size: 0.95rem;
      line-height: 1.55;
      color: var(--text-secondary, #475569);
      margin: 0;
      white-space: pre-line;
    }

    .dialog-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      background: var(--bg-main, #f8fafc);
      border-top: 1px solid var(--border-color, #e2e8f0);
    }

    .btn-cancel {
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 600;
      border: 1px solid var(--border-color, #cbd5e1);
      background: var(--bg-card, #ffffff);
      color: var(--text-secondary, #475569);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-cancel:hover {
      background: var(--bg-card-hover, #f1f5f9);
      color: var(--text-primary, #0f172a);
    }

    .btn-confirm {
      padding: 10px 22px;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .btn-confirm.btn-success {
      background: #10b981;
    }
    .btn-confirm.btn-success:hover {
      background: #059669;
      box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35);
    }

    .btn-confirm.btn-danger, .btn-confirm.btn-error {
      background: #e11d48;
    }
    .btn-confirm.btn-danger:hover, .btn-confirm.btn-error:hover {
      background: #be123c;
      box-shadow: 0 6px 16px rgba(225, 29, 72, 0.35);
    }

    .btn-confirm.btn-warning {
      background: #f59e0b;
      color: #0f172a;
    }
    .btn-confirm.btn-warning:hover {
      background: #d97706;
      box-shadow: 0 6px 16px rgba(245, 158, 11, 0.35);
    }

    .btn-confirm.btn-primary, .btn-confirm.btn-info {
      background: #0284c7;
    }
    .btn-confirm.btn-primary:hover, .btn-confirm.btn-info:hover {
      background: #0369a1;
      box-shadow: 0 6px 16px rgba(2, 132, 199, 0.35);
    }

    @keyframes backdropFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes dialogPopIn {
      from {
        opacity: 0;
        transform: scale(0.92) translateY(10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
  `]
})
export class FeedbackModalComponent {
  toasts$: Observable<ToastItem[]>;
  activeDialog$: Observable<any>;

  constructor(public notify: NotificationService) {
    this.toasts$ = this.notify.toasts$;
    this.activeDialog$ = this.notify.activeDialog$;
  }

  removeToast(id: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.notify.removeToast(id);
  }

  onConfirm(): void {
    this.notify.closeDialog(true);
  }

  onCancel(): void {
    this.notify.closeDialog(false);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.notify.closeDialog(false);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    this.notify.closeDialog(false);
  }
}
