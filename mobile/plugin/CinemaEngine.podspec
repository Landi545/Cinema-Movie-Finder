Pod::Spec.new do |s|
  s.name = 'CinemaEngine'
  s.version = '1.0.0'
  s.summary = 'Wspólny silnik repertuaru Cinema Movie Finder'
  s.license = 'MIT'
  s.homepage = 'https://github.com/Landi545/Cinema-Movie-Finder'
  s.author = 'Landi545'
  s.source = { :git => s.homepage + '.git', :tag => s.version }
  s.source_files = 'ios/*.{h,mm,m}'
  s.vendored_libraries = 'ios/lib/*.a'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.libraries = 'c++', 'z', 'resolv'
  s.frameworks = 'Security', 'SystemConfiguration'
end
