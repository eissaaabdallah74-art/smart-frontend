import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'import-button',
  standalone: true,
  templateUrl: './import-button.component.html',
  styleUrls: ['./import-button.component.scss'],
})
export class ImportButtonComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @Output() fileSelected = new EventEmitter<File>();

  triggerFileInput(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) this.fileSelected.emit(file);

    // reset to allow selecting the same file again
    input.value = '';
  }
}
