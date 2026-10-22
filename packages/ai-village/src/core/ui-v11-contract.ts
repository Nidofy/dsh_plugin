// Generated from docs/ai-village/ui-v1.1/ui-contract.json; validated by ui-v11 tests.
export const contract = {
  "id": "AV-UI-v1.1-20261022",
  "status": "PLANNED_NOT_IMPLEMENTED_NOT_VISUALLY_ACCEPTED",
  "baseline": {
    "commit": "e85ccc7",
    "packageVersion": "0.6.2",
    "worldSchema": 6,
    "preferencesSchema": 2,
    "frameProtocol": 3
  },
  "target": {
    "suggestedPackageVersion": "0.6.3",
    "worldSchema": 6,
    "preferencesSchema": 3,
    "frameProtocol": 3
  },
  "units": "CSS_PX_OF_PLUGIN_CONTENT_RECT_NOT_DEVICE_PIXELS",
  "priority": [
    "current-user-feedback",
    "this-contract-and-spec",
    "non-superseded-ui-v1",
    "review-suggestions"
  ],
  "breakpoints": {
    "minimumWidth": 320,
    "minimumHeight": 360,
    "shortHeight": 480,
    "fullHudWidth": 560,
    "wideWidth": 900
  },
  "typography": {
    "compact": {
      "condition": "W<560 OR H<480",
      "body": 13,
      "title": 15,
      "secondary": 12,
      "icon": 18
    },
    "regular": {
      "condition": "560<=W<900 AND H>=480",
      "body": 14,
      "title": 16,
      "secondary": 12,
      "icon": 20
    },
    "wide": {
      "condition": "W>=900 AND H>=480",
      "body": 15,
      "title": 18,
      "secondary": 13,
      "icon": 20
    },
    "lineHeight": 1.45,
    "minimumFinalBodyAndSecondary": 12,
    "textScaleValues": [
      0.9,
      1,
      1.15,
      1.3,
      1.5,
      2
    ],
    "defaultTextScale": 1,
    "multiplyByDpr": false,
    "scaleWithCamera": false,
    "fontFamily": "inherit host stack; system fallback"
  },
  "geometry": {
    "gutter": 12,
    "shortGutter": 8,
    "hitMin": 40,
    "primaryActionMinHeight": 44,
    "dockHeight": 48,
    "dockMaxWidth": 288,
    "dockToPanelGap": 8,
    "quick": {
      "normalMaxWidth": 360,
      "normalHeightFormula": "clamp(128,round(0.22*H),184)",
      "shortMaxWidth": 248,
      "shortMaxHeight": 128,
      "wideWidth": 296,
      "wideMaxHeight": 224,
      "wideTop": 64
    },
    "detail": {
      "normalMaxWidth": 360,
      "wideWidth": 320,
      "normalMaxHeightFormula": "min(320,floor(0.52*H))",
      "wideMaxHeightFormula": "min(360,floor(0.52*H))"
    },
    "settings": {
      "normalMaxWidth": 296,
      "shortMaxWidth": 248,
      "rootMaxHeightFormula": "min(224,floor(0.42*H))",
      "detailMaxHeightFormula": "min(320,floor(0.52*H))",
      "anchor": "top-right, clamp into viewport"
    },
    "readingMaxHeightFraction": 0.72,
    "readingRequiresExplicitAction": true,
    "quickManagementAreaBudget": {
      "normal": 0.35,
      "short": 0.42,
      "definition": "panel bounds + Dock bounds, excludes constant HUD; not multiplied by opacity"
    },
    "contentCanShrinkBelowMaximum": true,
    "ordinaryPanelsResizeIframe": false,
    "autoCameraMoveOnOpen": false,
    "shortAutoFullOpen": false
  },
  "hud": {
    "background": "transparent",
    "border": "none",
    "boxShadow": "none",
    "backdropFilter": "none",
    "iconAndTextOpacity": 1,
    "defaultSolidDock": false,
    "keepFourTextLabels": true,
    "focusRingRequired": true,
    "contrastFrom": "authored scene/environment foreground and halo; not frame-by-frame pixel reads"
  },
  "palette": {
    "scene": "courtyard",
    "light": {
      "tintRGB": [
        255,
        248,
        235
      ],
      "surfaceAlpha": 0.68,
      "ink": "#342E28",
      "secondary": "#433D36",
      "accent": "#4A351F"
    },
    "dark": {
      "tintRGB": [
        57,
        51,
        47
      ],
      "surfaceAlpha": 0.74,
      "ink": "#FFF6EA",
      "secondary": "#F5EBDD",
      "accent": "#F7E9CF"
    },
    "blurPx": 14,
    "saturate": 1.08,
    "panelRadius": 16,
    "maximumContrastAdjustmentAlpha": 0.82,
    "wholeContainerOpacity": 1,
    "fullScreenBlur": false,
    "nestedButtonBlur": false,
    "softwareFallback": "same-palette solid, panel only; HUD remains borderless transparent",
    "futurePalettes": "test fixtures only; no new scene assets or world fields"
  },
  "appearance": {
    "newInstallMode": "host",
    "preserveLegacyModes": true,
    "availableModes": [
      "host",
      "system",
      "light",
      "dark"
    ],
    "worldEnvironmentChangesThemePreference": false,
    "darkModeChangesWorldEnvironment": false
  },
  "navigation": {
    "tabs": [
      "residents",
      "wishes",
      "decor",
      "journal"
    ],
    "maxDepth": 8,
    "owner": "runtime.presentation",
    "back": "one-level restore route/scroll/focus without replaying actions",
    "close": "close tool navigation to scene",
    "closePlugin": "independent HUD command with dirty guards",
    "hideDockFor": [
      "settings",
      "notifications",
      "more",
      "view"
    ],
    "oneOrdinarySurfaceAtATime": true
  },
  "pause": {
    "manualAutoResume": false,
    "temporaryResumeOnlyOwnReason": true,
    "settingsPauseWorld": false,
    "automaticRetryDelaysMs": [
      1000,
      2000,
      4000
    ],
    "maxAutomaticAttempts": 3,
    "unknownWritesReplay": false,
    "hiddenOfflineTicks": false,
    "diagnosticMaxEntries": 200,
    "diagnosticMaxBytes": 32768,
    "diagnosticsContainSecretsOrRequestBodies": false
  },
  "motionMs": {
    "panel": 180,
    "subpage": 140,
    "hover": 120,
    "tooltipDelay": 250,
    "reducedMotion": 0
  },
  "unchanged": {
    "worldSize": [
      360,
      480
    ],
    "photoSize": [
      720,
      960
    ],
    "dragThreshold": 5,
    "snapRadius": 26,
    "ghostAlpha": 0.78,
    "undoSteps": 20,
    "singleWriter": true,
    "CAS": true,
    "composerAvoidance": true,
    "offlineResources": true,
    "oneHourRun": "DEFERRED"
  },
  "releaseGates": {
    "bodyContrast": 4.5,
    "essentialControlContrast": 3,
    "gpuGlassRequiresRealEvidence": true,
    "manualVisualApprovalCannotBeAutomated": true
  }
} as const
