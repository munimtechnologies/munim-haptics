# munim-haptics consumer ProGuard / R8 rules, applied to every app that
# depends on this library (consumerProguardFiles in build.gradle).

# The Nitro hybrid object and its generated structs and enums are created
# and read from C++ through JNI, so R8 cannot see their uses.
-keep class com.margelo.nitro.munimhaptics.** { *; }
-keep class com.munimhaptics.** { *; }
