#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$IOS_DIR/ExtAPI"
PROJECT="$PROJECT_DIR/DCloudUTSExtAPI.xcodeproj"
DERIVED_DIR="$IOS_DIR/.derived/extapi"
OUTPUT_DIR="$IOS_DIR/CustomFrameworks"
OUTPUT="$OUTPUT_DIR/DCloudUTSExtAPI.xcframework"

[[ -d "$IOS_DIR/SDK/ExtApiSrc" ]] || { echo "Missing uni-app x iOS SDK; run install-sdk.sh first." >&2; exit 1; }
command -v ruby >/dev/null || { echo "Ruby is required to generate the Xcode project." >&2; exit 1; }
ruby -e 'require "xcodeproj"' >/dev/null 2>&1 || { echo "Ruby gem xcodeproj is required." >&2; exit 1; }

export FOCUS_EXTAPI_IOS_DIR="$IOS_DIR"
export FOCUS_EXTAPI_PROJECT="$PROJECT"
ruby <<'RUBY'
require 'xcodeproj'
require 'fileutils'

ios_dir = ENV.fetch('FOCUS_EXTAPI_IOS_DIR')
project_path = ENV.fetch('FOCUS_EXTAPI_PROJECT')
source_dir = File.join(ios_dir, 'SDK', 'ExtApiSrc')

base_sources = %w[
  uni-getAppAuthorizeSetting-index.swift
  uni-getAppBaseInfo-index.swift
  uni-getDeviceInfo-index.swift
  uni-getSystemInfo-index.swift
  uni-getSystemSetting-index.swift
  uni-openAppAuthorizeSetting-index.swift
  uni-prompt-index.swift
  uni-rpx2px-index.swift
  uni-storage-index.swift
  uni-theme-index.swift
  uni-getElementById-DCUniGetElementById.swift
  uni-getElementById-index.swift
  uni-crash-index.swift
  uni-crash-UniCrashManager.swift
  uni-privacy-index.swift
  uni-dialogPage-index.swift
  uni-dialogPage-native.swift
  uni-event-index.swift
  uni-event-native.swift
  uni-exit-index.swift
  uni-actionSheet-index.swift
  uni-modal-index.swift
  uni-form-index.swift
  uni-form-UniInputView.swift
  uni-form-UniTextareaView.swift
]

module_sources = %w[
  uni-showLoading-index.swift
  uni-network-index.swift
  uni-getNetworkType-index.swift
  uni-getNetworkType-UniNetWorkManager.swift
  uni-createInnerAudioContext-index.swift
  uni-createInnerAudioContext-UniAudioPlayer.swift
  uni-camera-index.swift
  uni-camera-CameraImpl.swift
  uni-camera-CameraManager.swift
  uni-media-index.swift
  uni-media-utils-UniChooseFileManager.swift
  uni-getProvider-index.swift
  uni-oauth-index.swift
  uni-oauth-apple-index.swift
  uni-oauth-apple-AppleLoginNativeManager.swift
  uni-virtualPayment-index.swift
  uni-virtualPayment-Types.swift
  uni-virtualPayment-ProductService.swift
  uni-virtualPayment-PurchaseService.swift
  uni-virtualPayment-UniProduct.swift
  uni-virtualPayment-UniPurchase.swift
  uni-virtualPayment-UniStoreKit.swift
  uni-virtualPayment-UniStoreKit+Closure.swift
]

prompt_sources = Dir.children(source_dir).grep(/\Auni-prompt-Uni(?:Alert|Toast)-.*\.swift\z/).sort
swift_sources = base_sources + prompt_sources + module_sources
required = swift_sources + %w[UTSOC.h UTSOC.mm]
missing = required.reject { |name| File.exist?(File.join(source_dir, name)) }
abort "Missing SDK ExtApiSrc files: #{missing.join(', ')}" unless missing.empty?
config_path = File.join(ios_dir, 'ExtAPI', 'uts-config.json')
abort "Missing ExtAPI provider config: #{config_path}" unless File.exist?(config_path)

FileUtils.rm_rf(project_path)
project = Xcodeproj::Project.new(project_path)
target = project.new_target(:framework, 'DCloudUTSExtAPI', :ios, '15.0')
target.product_reference.name = 'DCloudUTSExtAPI.framework'

source_group = project.main_group.new_group('Sources')
swift_sources.each do |name|
  ref = source_group.new_file(File.join(source_dir, name))
  target.source_build_phase.add_file_reference(ref)
end
objc_ref = source_group.new_file(File.join(source_dir, 'UTSOC.mm'))
target.source_build_phase.add_file_reference(objc_ref)

headers_group = project.main_group.new_group('Headers')
umbrella_ref = headers_group.new_file(File.join(ios_dir, 'ExtAPI', 'DCloudUTSExtAPI.h'))
utsoc_ref = headers_group.new_file(File.join(source_dir, 'UTSOC.h'))
[umbrella_ref, utsoc_ref].each do |ref|
  build_file = target.headers_build_phase.add_file_reference(ref)
  build_file.settings = { 'ATTRIBUTES' => ['Public'] }
end

resources_group = project.main_group.new_group('Resources')
config_ref = resources_group.new_file(config_path)
target.resources_build_phase.add_file_reference(config_ref)

frameworks_group = project.frameworks_group
%w[DCloudUniappRuntime.xcframework DCloudUTSFoundation.xcframework KSCrash.xcframework storage.xcframework KTVHTTPCache.xcframework DCloudMediaPicker.xcframework].each do |name|
  ref = frameworks_group.new_file(File.join(ios_dir, 'SDK', 'Libs', name))
  build_file = target.frameworks_build_phase.add_file_reference(ref)
  build_file.settings = { 'ATTRIBUTES' => ['Weak'] } if name == 'KTVHTTPCache.xcframework'
end

target.build_configurations.each do |config|
  settings = config.build_settings
  settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
  settings['CODE_SIGN_STYLE'] = 'Automatic'
  settings['DEFINES_MODULE'] = 'YES'
  settings['ENABLE_MODULE_VERIFIER'] = 'NO'
  settings['FRAMEWORK_SEARCH_PATHS'] = ['$(inherited)', '$(PROJECT_DIR)/../SDK/Libs']
  settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  settings['INSTALL_PATH'] = '$(LOCAL_LIBRARY_DIR)/Frameworks'
  settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  settings['MACH_O_TYPE'] = 'mh_dylib'
  settings['OTHER_LDFLAGS'] = ['$(inherited)', '-ObjC']
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.zhuanzhuapp.mate.extapi'
  settings['PRODUCT_MODULE_NAME'] = 'DCloudUTSExtAPI'
  settings['PRODUCT_NAME'] = 'DCloudUTSExtAPI'
  settings['SKIP_INSTALL'] = 'NO'
  settings['SWIFT_INSTALL_OBJC_HEADER'] = 'YES'
  settings['SWIFT_VERSION'] = '5.0'
  settings['TARGETED_DEVICE_FAMILY'] = '1,2'
end

project.save
RUBY

xcodebuild archive \
  -project "$PROJECT" \
  -scheme DCloudUTSExtAPI \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$DERIVED_DIR/iphoneos" \
  -derivedDataPath "$DERIVED_DIR/iphoneos-derived" \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO \
  SKIP_INSTALL=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=YES

xcodebuild archive \
  -project "$PROJECT" \
  -scheme DCloudUTSExtAPI \
  -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  -archivePath "$DERIVED_DIR/iphonesimulator" \
  -derivedDataPath "$DERIVED_DIR/iphonesimulator-derived" \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO \
  SKIP_INSTALL=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=YES

mkdir -p "$OUTPUT_DIR"
rm -rf "$OUTPUT"
xcodebuild -create-xcframework \
  -framework "$DERIVED_DIR/iphoneos.xcarchive/Products/Library/Frameworks/DCloudUTSExtAPI.framework" \
  -framework "$DERIVED_DIR/iphonesimulator.xcarchive/Products/Library/Frameworks/DCloudUTSExtAPI.framework" \
  -output "$OUTPUT"

echo "Built $OUTPUT ($(du -sh "$OUTPUT" | awk '{print $1}'))"
