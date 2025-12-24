# Implementation Plan: GIF Export Feature

## Overview

This implementation plan adds GIF export capability to the video editor. The work is organized to build incrementally: first extending types, then implementing the GIF encoder, updating the UI, and finally wiring everything together.

## Tasks

- [x] 1. Extend export types and configuration
  - [x] 1.1 Add GIF export types to src/lib/exporter/types.ts
    - Add ExportFormat, GifFrameRate, GifSizePreset types
    - Add GifExportConfig and ExportSettings interfaces
    - Add GIF_SIZE_PRESETS and GIF_FRAME_RATES constants
    - _Requirements: 2.2, 4.2_

  - [x] 1.2 Write property test for frame rate validation
    - **Property 1: Valid Frame Rate Acceptance**
    - **Validates: Requirements 2.2**

- [x] 2. Implement GIF exporter module
  - [x] 2.1 Create src/lib/exporter/gifExporter.ts
    - Implement GifExporter class with constructor and config
    - Implement export() method using gif.js library
    - Implement cancel() and cleanup() methods
    - Reuse FrameRenderer and VideoFileDecoder from existing pipeline
    - _Requirements: 5.1, 5.3, 5.5_

  - [x] 2.2 Implement frame extraction and GIF encoding loop
    - Extract frames at configured frame rate
    - Apply trim region mapping (reuse from VideoExporter)
    - Add frames to gif.js encoder with proper delay
    - Report progress via callback
    - _Requirements: 5.1, 5.2_

  - [x] 2.3 Implement loop and size configuration
    - Configure gif.js with loop count (0 for infinite, 1 for once)
    - Calculate output dimensions based on size preset and aspect ratio
    - _Requirements: 3.2, 3.3, 4.2, 4.4_

  - [x] 2.4 Write property test for loop encoding
    - **Property 2: Loop Encoding Correctness**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 2.5 Write property test for aspect ratio preservation
    - **Property 4: Aspect Ratio Preservation**
    - **Validates: Requirements 4.4**

- [x] 3. Checkpoint - Ensure GIF exporter core works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update Export Dialog UI
  - [x] 4.1 Create FormatSelector component
    - Create src/components/video-editor/FormatSelector.tsx
    - Implement MP4/GIF toggle with card-style selection
    - Style to match existing dark theme
    - _Requirements: 1.1, 8.1_

  - [x] 4.2 Create GifOptionsPanel component
    - Create src/components/video-editor/GifOptionsPanel.tsx
    - Implement frame rate dropdown with preset options
    - Implement loop toggle switch
    - Implement size preset selector
    - Display calculated output dimensions
    - _Requirements: 2.1, 3.1, 4.1, 4.3_

  - [x] 4.3 Update ExportDialog component
    - Add format selection state and handlers
    - Conditionally render MP4 options or GIF options based on format
    - Update onExport to pass ExportSettings
    - Disable format selection during export
    - _Requirements: 1.2, 1.3, 1.4, 8.2, 8.3, 8.5_

- [x] 5. Integrate GIF export into VideoEditor
  - [x] 5.1 Update VideoEditor handleExport function
    - Accept ExportSettings from dialog
    - Route to VideoExporter or GifExporter based on format
    - Handle GIF blob saving with .gif extension
    - _Requirements: 5.3, 7.3_

  - [x] 5.2 Add GIF exporter to index exports
    - Update src/lib/exporter/index.ts to export GifExporter
    - Export new types
    - _Requirements: 5.1_

- [x] 6. Checkpoint - Ensure full integration works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Write remaining property tests
  - [x] 7.1 Write property test for size preset resolution
    - **Property 3: Size Preset Resolution Mapping**
    - **Validates: Requirements 4.2**

  - [x] 7.2 Write property test for valid GIF output
    - **Property 5: Valid GIF Output**
    - **Validates: Requirements 5.3**

  - [x] 7.3 Write property test for frame count consistency
    - **Property 6: Frame Count Consistency**
    - **Validates: Requirements 5.1**

  - [x] 7.4 Write regression test for MP4 export
    - **Property 7: MP4 Export Regression**
    - **Validates: Requirements 7.2**

- [x] 8. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- The gif.js library needs to be installed: `npm install gif.js @types/gif.js`
