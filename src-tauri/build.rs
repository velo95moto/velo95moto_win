fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/biometric.m")
            .flag("-fobjc-arc")
            .compile("biometric");
        println!("cargo:rustc-link-lib=framework=LocalAuthentication");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }
    tauri_build::build()
}
