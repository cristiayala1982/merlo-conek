import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Componente global de modal de reporte estandarizado.
 * Opciones consistentes en toda la aplicación.
 */
export default function SelectorReporteModal({ visible, onClose, onReportar, onSelectMotivo }) {
  const opciones = [
    {
      id: 'spam',
      label: 'Spam / Contenido Repetido',
      icon: 'alert-circle-outline',
      color: '#374151'
    },
    {
      id: 'inapropiado',
      label: 'Contenido Inapropiado / Obsceno',
      icon: 'warning-outline',
      color: '#374151'
    },
    {
      id: 'falso',
      label: 'Información Falsa / Engañosa',
      icon: 'close-circle-outline',
      color: '#374151'
    },
    {
      id: 'acoso',
      label: 'Acoso / Violencia / Lenguaje Inapropiado',
      icon: 'warning-outline',
      color: '#374151'
    },
    {
      id: 'bullying',
      label: 'Bullying / Acoso',
      icon: 'people-outline',
      color: '#374151'
    }
  ];

  const handleSeleccionar = (opcion) => {
    const callback = onReportar || onSelectMotivo;
    callback?.(opcion.label);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuContent}>
          <View style={styles.menuIndicator} />
          <Text style={styles.menuTitle}>¿Por qué reportas esta publicación?</Text>

          {opciones.map((opcion) => (
            <TouchableOpacity
              key={opcion.id}
              style={styles.menuOption}
              onPress={() => handleSeleccionar(opcion)}
            >
              <Ionicons name={opcion.icon} size={22} color={opcion.color} />
              <Text style={styles.menuOptionText}>{opcion.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.menuCancelBtn} onPress={onClose}>
            <Text style={styles.menuCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  menuIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 15,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuOptionText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
    flexWrap: 'wrap',
  },
  menuCancelBtn: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});