import re

def update_types():
    with open('src/types.ts', 'r') as f:
        content = f.read()
    
    content = content.replace(
        "week_start_date: string // YYYY-MM-DD\n  view_mode: 'carousel' | 'list'",
        "week_start_date: string // YYYY-MM-DD\n  is_visible: boolean\n  view_mode: 'carousel' | 'list'"
    )
    
    with open('src/types.ts', 'w') as f:
        f.write(content)

def update_transforms():
    with open('src/hooks/storeTransforms.ts', 'r') as f:
        content = f.read()
    
    content = content.replace(
        "week_start_date: row.week_start_date,",
        "week_start_date: row.week_start_date,\n    is_visible: row.is_visible ?? true,"
    )
    
    with open('src/hooks/storeTransforms.ts', 'w') as f:
        f.write(content)

def update_mutations():
    with open('src/hooks/storeMutations/serviceSuggestions.ts', 'r') as f:
        content = f.read()
        
    content = content.replace(
        "week_start_date: string\n  view_mode: 'carousel' | 'list'",
        "week_start_date: string\n  is_visible: boolean\n  view_mode: 'carousel' | 'list'"
    )
    
    content = content.replace(
        "week_start_date: input.week_start_date,\n    view_mode: input.view_mode,",
        "week_start_date: input.week_start_date,\n    is_visible: input.is_visible,\n    view_mode: input.view_mode,"
    )
    
    with open('src/hooks/storeMutations/serviceSuggestions.ts', 'w') as f:
        f.write(content)

update_types()
update_transforms()
update_mutations()
