'use client'
import { createContext, useContext } from 'react'

interface LangContextType {
  lang: 'ar' | 'en'
  isAr: boolean
}

export const LanguageContext = createContext<LangContextType>({
  lang: 'en',
  isAr: false,
})

export function useLang() { return useContext(LanguageContext) }
