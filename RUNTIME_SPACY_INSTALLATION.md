# Runtime spaCy Model Installation for HireLens

This document explains how the spaCy English model (`en_core_web_sm`) is installed and managed at runtime in the HireLens application.

## Approach

Instead of installing the spaCy model during the Docker build process, we've implemented a runtime installation approach that:

1. Checks if the model is already available
2. Installs the model if it's missing
3. Handles errors gracefully
4. Allows the application to continue running with limited functionality if installation fails

## Implementation Details

### 1. Application Startup (main.py)

The `lifespan` function in [main.py](file:///D:/PersonalProjects/HireLens/server/app/main.py) now includes robust spaCy model verification and installation:

- Uses `verify_and_install_spacy_model()` function to check and install the model
- Implements timeout handling for installation processes
- Provides fallback installation methods
- Logs detailed information about the installation process

### 2. Service Classes

Both service classes have been updated to handle runtime model installation:

#### ResumeParserService ([resume_parser_service.py](file:///D:/PersonalProjects/HireLens/server/app/services/resume_parser_service.py))

- Uses `ensure_spacy_model()` function to verify/install the model at initialization
- Continues to operate with limited functionality if the model is not available
- Provides clear logging about model status

#### ATSScorer ([ats_scoring_service.py](file:///D:/PersonalProjects/HireLens/server/app/services/ats_scoring_service.py))

- Similarly uses `ensure_spacy_model()` function
- Gracefully degrades to basic functionality without the model
- Maintains core scoring capabilities even without advanced NLP features

### 3. Error Handling

The implementation includes comprehensive error handling:

- **Timeout Protection**: 5-minute timeout for model installation
- **Fallback Methods**: Alternative installation approaches if the primary method fails
- **Graceful Degradation**: Services continue to work with reduced functionality
- **Detailed Logging**: Clear error messages and status updates

## Benefits of Runtime Installation

1. **Deployment Flexibility**: No need to modify Docker build process
2. **Error Recovery**: Can recover from initial installation failures
3. **Resource Management**: Model installation only when actually needed
4. **Environment Adaptability**: Works in various deployment environments
5. **Version Compatibility**: Ensures model version matches spaCy version

## Testing

Two test scripts verify the implementation:

1. `test_spacy_model.py` - Tests the basic runtime installation approach
2. `test_runtime_services.py` - Tests service initialization with runtime model loading

## Usage

The system automatically handles model installation at application startup. No manual intervention is required in most cases.

If manual installation is needed:
```bash
python -m spacy download en_core_web_sm
```

## Troubleshooting

If the runtime installation fails:

1. Check internet connectivity
2. Verify Python and spaCy installation
3. Try manual installation with the command above
4. Check logs for specific error messages