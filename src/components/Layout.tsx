{/* Sidebar */}
<div className="hidden md:fixed md:inset-y-0 md:left-0 md:z-50 md:w-64 md:bg-white md:shadow-lg md:block">
  <div className="flex h-16 items-center justify-center border-b border-gray-200">
    <div className="text-center">
      <h1 className="text-xl font-bold text-gray-900">Event Manager</h1>
      {userCompany && (
        <p className="text-sm text-blue-600">{userCompany.company.name}</p>
      )}
    </div>
  </div>
  <nav className="mt-8 space-y-1 px-4">
    {navigation.filter(item => {
      if (userCompany && item.href === '/admin') return false
      return true
    }).map((item) => {
      const Icon = item.icon
      const isActive = location.pathname === item.href || 
        (item.href !== '/admin' && location.pathname.startsWith(item.href))
      
      return (
        <Link
          key={item.name}
          to={item.href}
          className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            isActive
              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Icon className="mr-3 h-5 w-5" />
          {item.name}
        </Link>
      )
    })}
  </nav>
  <div className="absolute bottom-4 left-4 right-4">
    <button
      onClick={handleSignOut}
      className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
    >
      <LogOut className="mr-3 h-5 w-5" />
      Sign Out
    </button>
  </div>
</div>

{/* Main content */}
<div className="flex-1 md:ml-64">
  <main className="flex-1 p-8">
    {children}
  </main>
</div>
