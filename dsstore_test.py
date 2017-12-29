from ds_store import DSStore

with DSStore.open('/Users/foo/mydir/.DS_Store', 'r+') as d:
    print d['ralphy-config.json']['icvp']
    
    # Position the icon for "foo.txt" at (128, 128)
  
  #id['foo.txt']['Iloc'] = (128, 128)

  # Display the plists for this folder
 # print d['.']['bwsp']
 # print d['.']['icvp']
