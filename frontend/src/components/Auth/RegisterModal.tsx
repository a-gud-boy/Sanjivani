import { useState, useEffect } from 'react'
import type { User, UserType } from '../../types'
import PatientRegisterModal from './PatientRegisterModal'
import DoctorRegisterModal from './DoctorRegisterModal'

interface RegisterModalProps {
  isOpen: boolean
  onClose: () => void
  initialRole?: UserType
  onSuccessLogin?: (user: User, token?: string) => void
  onPrefillLogin?: (id: string, role: UserType) => void
}

export default function RegisterModal({
  isOpen,
  onClose,
  initialRole = 'patient',
  onSuccessLogin,
  onPrefillLogin,
}: RegisterModalProps) {
  const [role, setRole] = useState<UserType>(initialRole)

  useEffect(() => {
    setRole(initialRole)
  }, [initialRole])

  if (!isOpen) return null

  if (role === 'doctor') {
    return (
      <DoctorRegisterModal
        isOpen={isOpen}
        onClose={onClose}
        onSuccessLogin={onSuccessLogin}
        onPrefillLogin={(id) => onPrefillLogin?.(id, 'doctor')}
      />
    )
  }

  return (
    <PatientRegisterModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccessLogin={onSuccessLogin}
      onPrefillLogin={(id) => onPrefillLogin?.(id, 'patient')}
    />
  )
}
