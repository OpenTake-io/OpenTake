# Requirements Document

## Introduction

This feature extends the existing video export functionality to support GIF export as an alternative output format. The export dialog will be redesigned to present users with a format selection menu, allowing them to choose between MP4 video export (with quality options) or GIF export (with GIF-specific options like frame rate, looping, and size).

## Glossary

- **Export_Dialog**: The modal UI component that displays export options and progress
- **Format_Selector**: The UI component allowing users to choose between MP4 and GIF export formats
- **GIF_Exporter**: The module responsible for encoding video frames into animated GIF format
- **Frame_Rate**: The number of frames per second in the output GIF (affects file size and smoothness)
- **Loop_Setting**: Configuration determining whether the GIF plays once or loops infinitely
- **Size_Preset**: Predefined output dimension options for GIF export (e.g., small, medium, large)
- **Quality_Preset**: Predefined quality levels for MP4 export (low, medium, high/source)

## Requirements

### Requirement 1: Export Format Selection

**User Story:** As a user, I want to choose between exporting as MP4 or GIF, so that I can create the appropriate format for my use case.

#### Acceptance Criteria

1. WHEN the user clicks the export button, THE Export_Dialog SHALL display a format selection menu with MP4 and GIF options
2. WHEN the user selects MP4 format, THE Export_Dialog SHALL display MP4-specific quality options (low, medium, high/source)
3. WHEN the user selects GIF format, THE Export_Dialog SHALL display GIF-specific options (frame rate, loop, size)
4. THE Export_Dialog SHALL remember the user's last selected format for the current session

### Requirement 2: GIF Frame Rate Configuration

**User Story:** As a user, I want to control the frame rate of my GIF export, so that I can balance between smoothness and file size.

#### Acceptance Criteria

1. WHEN GIF format is selected, THE Export_Dialog SHALL display a frame rate selector with preset options
2. THE GIF_Exporter SHALL support frame rates of 10, 15, 20, 25, and 30 FPS
3. WHEN a frame rate is selected, THE Export_Dialog SHALL display an estimated file size indicator
4. THE GIF_Exporter SHALL default to 15 FPS for optimal balance between quality and file size

### Requirement 3: GIF Loop Configuration

**User Story:** As a user, I want to control whether my GIF loops or plays once, so that I can create the appropriate animation behavior.

#### Acceptance Criteria

1. WHEN GIF format is selected, THE Export_Dialog SHALL display a loop toggle option
2. WHEN loop is enabled, THE GIF_Exporter SHALL encode the GIF to loop infinitely
3. WHEN loop is disabled, THE GIF_Exporter SHALL encode the GIF to play once and stop
4. THE GIF_Exporter SHALL default to loop enabled

### Requirement 4: GIF Size Configuration

**User Story:** As a user, I want to control the output size of my GIF, so that I can optimize for different platforms and use cases.

#### Acceptance Criteria

1. WHEN GIF format is selected, THE Export_Dialog SHALL display size preset options
2. THE GIF_Exporter SHALL support size presets: Small (480p), Medium (720p), Large (1080p), and Original
3. WHEN a size preset is selected, THE Export_Dialog SHALL display the actual output dimensions
4. THE GIF_Exporter SHALL maintain the video's aspect ratio when resizing
5. THE GIF_Exporter SHALL default to Medium (720p) size preset

### Requirement 5: GIF Export Processing

**User Story:** As a user, I want to export my edited video as a GIF with all applied effects, so that I can share animated content.

#### Acceptance Criteria

1. WHEN the user initiates GIF export, THE GIF_Exporter SHALL process all video frames with applied effects (zoom, crop, annotations, trim)
2. WHEN exporting, THE Export_Dialog SHALL display real-time progress with percentage and frame count
3. WHEN export completes, THE GIF_Exporter SHALL produce a valid animated GIF file
4. IF an error occurs during export, THEN THE Export_Dialog SHALL display a descriptive error message
5. WHEN the user cancels export, THE GIF_Exporter SHALL stop processing and clean up resources

### Requirement 6: GIF Color Optimization

**User Story:** As a user, I want my GIF to have good color quality despite the 256 color limitation, so that the output looks visually appealing.

#### Acceptance Criteria

1. THE GIF_Exporter SHALL use color quantization to reduce colors to 256 per frame
2. THE GIF_Exporter SHALL apply dithering to improve perceived color quality
3. THE GIF_Exporter SHALL optimize the color palette for each frame or use a global palette based on content

### Requirement 7: MP4 Export Preservation

**User Story:** As a user, I want the existing MP4 export functionality to remain available with its current quality options, so that I can still export high-quality videos.

#### Acceptance Criteria

1. WHEN MP4 format is selected, THE Export_Dialog SHALL display quality options: Low (720p), Medium (1080p), High/Source (original resolution)
2. THE Video_Exporter SHALL maintain all existing MP4 export functionality unchanged
3. WHEN MP4 export completes, THE system SHALL save the file with .mp4 extension

### Requirement 8: Export Dialog UI Design

**User Story:** As a user, I want a clean and intuitive export interface, so that I can easily configure and initiate exports.

#### Acceptance Criteria

1. THE Export_Dialog SHALL display format options as visually distinct selectable cards or tabs
2. WHEN a format is selected, THE Export_Dialog SHALL animate the transition to show format-specific options
3. THE Export_Dialog SHALL display a prominent "Export" button to initiate the export process
4. THE Export_Dialog SHALL maintain the existing dark theme and visual style of the application
5. WHEN exporting, THE Export_Dialog SHALL disable format selection and show progress UI
