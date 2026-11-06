#!/bin/zsh
# Typechecks munim-haptics' Swift (implementation + nitrogen output) against
# the iOS SDK and the real NitroModules Swift/C++ sources, with C++ interop,
# the way the CocoaPods build compiles them. No Xcode project, no Pods.
set -euo pipefail
LIB=${1:-$(cd "$(dirname "$0")/.." && pwd)}
NM=$LIB/node_modules/react-native-nitro-modules
RN=$LIB/node_modules/react-native
W=$(mktemp -d)
trap 'rm -rf $W' EXIT
mkdir -p $W/inc/NitroModules $W/inc/MunimHaptics $W/mods/NitroModules $W/mods/MunimHaptics $W/out
SDK=$(xcrun --sdk iphoneos --show-sdk-path)
TARGET=arm64-apple-ios${IOS_MIN:-15.1}

# Flattened public headers, like Pods/Headers/Public/<Pod>/
for f in $(find $NM/cpp $NM/ios -name '*.hpp' -o -name '*.h'); do ln -sf $f $W/inc/NitroModules/; done
for f in $(find $LIB/nitrogen/generated/shared $LIB/nitrogen/generated/ios -name '*.hpp' -o -name '*.h'); do ln -sf $f $W/inc/MunimHaptics/; done

# NitroModules clang module: every header except the Fabric view ones (they
# need React's renderer headers), so none of them is textual in two modules.
{
  # CocoaPods' umbrella header pulls in Foundation (prefix header) too.
  cat > $W/inc/NitroModules/PodPrefix.h <<'EOF'
#include <malloc/malloc.h>
#ifdef __OBJC__
#import <Foundation/Foundation.h>
#endif
EOF
  echo 'module NitroModules {'
  echo "  header \"$W/inc/NitroModules/PodPrefix.h\""
  for f in $(find $NM/cpp $NM/ios \( -name '*.hpp' -o -name '*.h' \) | grep -v '/views/' | grep -v '/turbomodule/' | grep -v 'NativeNitroModules' ); do
    echo "  header \"$W/inc/NitroModules/$(basename $f)\""
  done
  echo '  requires cplusplus'
  echo '  export *'
  echo '}'
} > $W/mods/NitroModules/module.modulemap

{
  echo 'module MunimHaptics {'
  for f in $LIB/nitrogen/generated/shared/c++/*.hpp; do echo "  header \"$W/inc/MunimHaptics/$(basename $f)\""; done
  echo "  header \"$W/inc/MunimHaptics/MunimHaptics-Swift-Cxx-Bridge.hpp\""
  echo '  requires cplusplus'
  echo '  export *'
  echo '}'
} > $W/mods/MunimHaptics/module.modulemap

COMMON=(-sdk $SDK -target $TARGET -cxx-interoperability-mode=default
  -Xcc -std=c++20 -Xcc -I$W/inc -Xcc -I$W/inc/NitroModules -Xcc -I$W/inc/MunimHaptics
  -Xcc -I$RN/ReactCommon/jsi -Xcc -I$RN/ReactCommon -Xcc -I$RN/ReactCommon/callinvoker
  -Xcc -DNDEBUG -swift-version 5 -module-cache-path $W/cache)

echo "== NitroModules (Swift module)"
xcrun swiftc -emit-module -module-name NitroModules -emit-module-path $W/out/NitroModules.swiftmodule \
  -I $W/mods/NitroModules -import-underlying-module $COMMON \
  $(find $NM/ios -name '*.swift' | grep -v '/views/HybridView')

echo "== MunimHaptics (Swift typecheck + generated C++ header)"
xcrun swiftc -emit-module -module-name MunimHaptics -emit-module-path $W/out/MunimHaptics.swiftmodule   -emit-clang-header-path $W/inc/MunimHaptics/MunimHaptics-Swift.h   -I $W/out -I $W/mods/NitroModules -I $W/mods/MunimHaptics -import-underlying-module $COMMON   $(find $LIB/nitrogen/generated/ios -name '*.swift') $LIB/ios/*.swift

# Nitro's own Swift header, which its C++ headers include the same way.
xcrun swiftc -emit-module -module-name NitroModules -emit-module-path $W/out2.swiftmodule   -emit-clang-header-path $W/inc/NitroModules/NitroModules-Swift.h   -I $W/mods/NitroModules -import-underlying-module $COMMON   $(find $NM/ios -name '*.swift' | grep -v '/views/HybridView') >/dev/null

echo "== Generated C++ / Objective-C++ bridge (syntax check)"
TOOLCHAIN=$(dirname $(dirname $(xcrun -f swiftc)))
for f in $LIB/nitrogen/generated/ios/*.cpp $LIB/nitrogen/generated/ios/c++/*.cpp $LIB/nitrogen/generated/ios/*.mm; do
  # Like the pod build: headers are textual in C++, Clang modules only for ObjC++.
  if [[ $f == *.mm ]]; then LANG_FLAGS=(-x objective-c++ -fobjc-arc -fmodules -fmodules-cache-path=$W/cache); else LANG_FLAGS=(-x c++); fi
  xcrun clang++ -fsyntax-only -std=c++20 -isysroot $SDK -target $TARGET $LANG_FLAGS     -I$W/inc -I$W/inc/NitroModules -I$W/inc/MunimHaptics -I$RN/ReactCommon/jsi -I$RN/ReactCommon     -I$TOOLCHAIN/lib/swift -DNDEBUG $f
  echo "   ok $(basename $f)"
done
echo "== OK"
